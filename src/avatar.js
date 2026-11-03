import { avatarSource } from "./urls.js";

// VDO.Ninja reads avatars without credentials. Prefer original resolution
// only for publicly accessible HTTPS images with explicit CORS permission.
export function canUseDirectAvatar(source, allowOrigin, contentType = "") {
  let url;
  try { url = new URL(source); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (!contentType.toLowerCase().startsWith("image/")) return false;
  const cors = String(allowOrigin ?? "").trim();
  return cors === "*" || cors === "https://vdo.ninja";
}

export async function prepareAvatar(user, prefs, { signal, baseURL = location.href, maxEncodedLength = 5800 } = {}) {
  const source = avatarSource(user, prefs, baseURL);
  if (!source || source === "default") return { value: source, source };
  let response;
  try {
    const anonymous = await fetch(source, { credentials: "omit", cache: "no-store", signal });
    if (anonymous.ok && canUseDirectAvatar(source,
      anonymous.headers.get("access-control-allow-origin"),
      anonymous.headers.get("content-type") ?? "")) {
      return { value: source, source, direct: true };
    }
    if (anonymous.ok && (anonymous.headers.get("content-type") ?? "").startsWith("image/")) response = anonymous;
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  if (!response) response = await fetch(source, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error(`Avatar: não foi possível carregar a imagem (HTTP ${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Avatar: o endereço não devolveu uma imagem. Confira a imagem do usuário Foundry.");
  if (blob.size > 10 * 1024 * 1024) throw new Error("Avatar: use uma imagem menor que 10 MB.");
  const objectURL = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectURL;
    await image.decode();
    signal?.throwIfAborted();
    const canvas = document.createElement("canvas");
    for (const edge of [640, 512, 448, 384, 320, 256, 192, 128, 96, 64]) {
      const ratio = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
        const value = canvas.toDataURL("image/webp", quality);
        if (encodeURIComponent(value).length <= maxEncodedLength) return { value, source, direct: false };
      }
    }
    throw new Error("Avatar: imagem complexa demais para incluir com qualidade no link. Use uma imagem mais leve.");
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}
