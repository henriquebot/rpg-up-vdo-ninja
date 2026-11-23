export function element(tag, text, attributes = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function select(options, value, name) {
  const node = element("select", undefined, { name, "aria-label": name });
  for (const [key, label] of Object.entries(options)) node.append(element("option", label, { value: key }));
  node.value = value;
  return node;
}

export function tooltip(node, text) {
  node.title = text;
  node.dataset.tooltipText = text;
  node.dataset.tooltip = text;
  return node;
}

export function panel(title, help, ...children) {
  const node = element("fieldset", undefined, { class: "rpgup-panel" });
  node.append(element("legend", title));
  if (help) node.append(element("p", help, { class: "rpgup-help" }));
  node.append(...children);
  return node;
}

export function button(label, icon, attributes = {}) {
  const node = element("button", undefined, { type: "button", ...attributes });
  node.append(element("i", undefined, { class: `fa-solid ${icon}`, "aria-hidden": "true" }), element("span", label));
  return node;
}

export function downloadJSON(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = element("a", undefined, { href: url, download: filename, hidden: "" });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function field(label, control, help) {
  const node = element("label", undefined, { class: "rpgup-field" });
  const caption = element("span", undefined, { class: "rpgup-field-caption" });
  caption.append(element("span", label));
  if (help) {
    const info = element("span", undefined, {
      class: "rpgup-info-icon", role: "img", tabindex: "0",
      "aria-label": "Ajuda: " + help
    });
    info.append(element("i", undefined, { class: "fas fa-circle-info", "aria-hidden": "true" }));
    tooltip(info, help);
    caption.append(info);
  }
  node.append(caption, control);
  return node;
}

export function report(error) {
  ui.notifications.error(error.message ?? String(error));
}
