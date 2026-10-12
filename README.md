# RPGUP VDO.Ninja

Interface Foundry VTT **v13/v14** para uma **Room oficial VDO.Ninja**. Um iframe local por cliente, Stream IDs estáveis configurados pelo GM e um dock ApplicationV2 próprio. O jogador usa os controles nativos do VDO.Ninja para ativar a câmera e participar.

**Versão de produção: 1.0.11.** Protótipo aprovado pelo usuário em 01/10/2026, com autorização expressa para produção. Compatibilidade declarada: Foundry **v13 e v14** (`minimum: 13`, `verified: 14`, `maximum: 14`). [Aprovação e evidências de teste](docs/PROTOTYPE-RESULTS.md).

A arquitetura vigente está em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). A proposta anterior foi preservada, sem alterações, em [docs/ARCHITECTURE-OLD-MEDIAMTX.md](docs/ARCHITECTURE-OLD-MEDIAMTX.md) **apenas como histórico superado**.

## Instalar e configurar

1. Use Foundry v13 ou v14 em HTTPS ou localhost.
2. No Setup → Módulos → Instalar módulo, cole o manifest: `https://raw.githubusercontent.com/henriquebot/rpgup-vdo-ninja/main/module.json`. O módulo não instala dependências de runtime nem exige build.
3. No World, habilite **RPGUP VDO.Ninja** em Gerenciar módulos.
4. GM: Configurações → Configurar opções → **RPGUP VDO.Ninja — Configurar mesa**. Na primeira guia (casa), a Room sugerida vem do nome do World (sem espaços/acentos); pode ser editada e só se torna definitiva ao salvar. Na guia de participantes (pessoas), clique em **Gerar e salvar slots faltantes**. Aguarde a confirmação: Room e IDs já ficam salvos no mundo. Opcionalmente informe imagens em **Avatar da mesa**; vazio usa o avatar Foundry do usuário.
5. Cada cliente: a dock abre ao entrar. Para abrir/reabrir manualmente, clique em **Câmeras VDO.Ninja** na aba Configurações da sidebar. O jogador que aguardava um slot entra ao receber a associação salva. Quem já está conectado usa a engrenagem → **Aplicar / reconectar**. A câmera e a permissão são ativadas na UI nativa do VDO.
6. GM: copie o **Solo link OBS** para a Browser Source (somente visualização). Para quem não consegue entrar pela dock, use a coluna **Entrar pelo navegador** e o ícone de copiar: esse link permite publicar a própria câmera com nome, Room e Stream ID salvos e tenta incorporar o avatar. Envie o link somente ao jogador, que deve **fechar a dock embutida** antes de abrir o navegador para evitar duplicidade de publicação. Ao alterar Room, senha, ID ou avatar, salve primeiro e copie novamente o link.

O [repositório](https://github.com/henriquebot/rpgup-vdo-ninja) contém o código e o manifest vigentes na `main`. A partir de **v1.0.4**, o GitHub Release inclui os assets **module.json** e **rpgup-vdo-ninja.zip**. A instalação automática usa o manifest fixo da `main`, apontando para o ZIP de uma release versionada. O workflow de GitHub Actions publica a versão após passar pelos testes na `main`.

Para instalação manual de desenvolvimento, execute `npm run package` com Node.js 20+ e copie `dist/rpgup-vdo-ninja` para `<User Data>/Data/modules/rpgup-vdo-ninja`. Uma nova versão atualiza `module.json`/`package.json` e seu link de distribuição.

## Nomes, temas e indicadores de fala

- O nome de cada câmera vem de **Usuários do Foundry** e aparece por padrão no VDO.Ninja com `showlabels=rounded`. Não precisa preencher nomes manualmente.
- GM: clique em **Configurar mesa → Aparência (paleta)** e escolha entre Sem bordas, Sci-fi, Moderno, Neon, Rústico ou Fantástico. Moderno é padrão. Cada moldura tenta usar a cor **Color** definida no perfil do respectivo usuário Foundry (uma por Stream ID), com cor neutra se o perfil não tiver cor válida.
- Com **áudio nativo VDO** a borda pode engrossar suavemente quando o medidor oficial detectar uma pessoa falando. **Áudio por Discord:** o VDO recebe áudio desativado, portanto **não consegue detectar falantes no Discord**. Isso não exige permissões ou integrações adicionais.
- CSS e rótulos são aplicados nas entradas de participantes, incluindo links de navegador externo. OBS solo permanece limpo para preservar cenas existentes. As classes das câmeras pertencem ao VDO e precisam ser validadas após atualizações upstream.
- Os avatares da câmera desligada são redimensionados com maior nitidez que versões anteriores, usando WebP até 640px quando couber no limite de segurança de 6.900 caracteres para a URL. O avatar original do Foundry continua intacto; alguns arquivos muito pesados podem precisar de uma imagem mais simples.

## Uso e limites

- **Esquerda por padrão**, inclusive para preferências antigas que ainda usavam o default flutuante. Preferências antigas que escolheram outra borda permanecem nessa borda; escolher Flutuante após atualizar também é lembrado. Depois, sua posição escolhida é lembrada. Na borda esquerda/direita/topo/embaixo, CSS reserva espaço em `#interface` para controles, navegação, hotbar e sidebar. O canvas continua em tela cheia. A integração de layout é específica do DOM v13/v14 e deve ser conferida com os módulos de UI da mesa.
- **Engrenagem no cabeçalho**: a dock abre com as opções recolhidas. Ao abrir, mostre as guias por ícones (Configurar mesa, Janela, Imagem, Ajuda). A primeira guia traz Configurar mesa (GM) e Aplicar / reconectar. Use o ícone da bússola para um tour com explicações curtas. Passe o mouse sobre os ícones para ver tooltips. O ícone vizinho desacopla a dock sem reconectar.
- **↻ Recarregar sala VDO**, no cabeçalho, recarrega apenas sua sala para atualizar mudanças do Director. Reinicia a conexão/câmera VDO e mantém a página Foundry aberta, a geometria, a Room e o ID atuais. Não salva rascunhos GM nem aplica opções pendentes do módulo; para isso use **Aplicar / reconectar**. Não recarrega os outros participantes.
- Preferências individuais (posição, tamanho, abertura automática, zoom e avatar) ficam em flags do usuário no World. Reabrir o menu e reposicionar o dock preservam o iframe e sua sessão. Fechar o dock encerra a conexão; reconectar é uma ação explícita. O painel GM preserva rascunhos ao redesenhar; aplicar no GM salva seu rascunho aberto antes de reconectar. Uma mudança ainda não aplicada destaca a engrenagem e informa o motivo ao passar o mouse.
- **Zoom − / percentual / +** ajusta somente o iframe, de 50% a 150%, sem recarregar a sala. Clique no percentual para voltar a 100%. A área do iframe acompanha o tamanho da janela.
- Câmera e microfone são escolhidos na **engrenagem do próprio VDO**. Self-preview, mini preview e PiP usam seus controles/menu de contexto nativos. Com foco no VDO, Ctrl+Alt+P alterna o PiP local (Cmd+Alt+P no Mac). O navegador pode exigir gesto para PiP; sua posição e tamanho dependem do navegador. O módulo não cria outro viewer da própria câmera. Os seletores redundantes de câmera por nome, PC/Móvel e self-preview foram removidos.
- Placeholder inicial: **Avatar Foundry / da mesa**, preparado novamente em cada entrada. Se o GM definir **Avatar da mesa**, essa imagem é usada; caso contrário, usa a imagem do usuário Foundry. **Imagem por URL** individual tem prioridade; **Sem placeholder** omite o parâmetro. O módulo lê a imagem pela sessão Foundry, reduz uma miniatura estática e usa o parâmetro oficial `avatar` como imagem incorporada, evitando a exigência de CORS do VDO para os arquivos Foundry. A imagem preparada aparece nas configurações; falhas mostram aviso e usam a imagem padrão do VDO. Imagens externas precisam permitir leitura pelo navegador a partir do Foundry. Arquivos escolhidos somente dentro do iframe não são importados nem lembrados pelo módulo.
- **Abrir esta janela ao entrar no mundo** abre somente a dock; não ativa sua câmera. Desmarque para abrir manualmente pelo menu do módulo ou pela macro abaixo. Essa escolha também é lembrada.
- Áudio inicial: Discord, com `audiodevice=0` e `noaudio` e sem delegação de microfone. Para testar microfone, volume e controles nativos, mude para **Áudio e controles nativos VDO.Ninja** e reconecte todos. Evite usar os dois canais de voz simultaneamente durante a prova.
- Qualidade: **Automático** mantém o VDO adaptativo; **Economia**, **Equilibrado** e **Mais detalhe** limitam os vídeos entre jogadores a 200/500/1.200 kbps e captura a até 20/30/30 fps por `maxframerate`. A qualidade efetiva depende de dispositivos, rede e orçamento da Room. Mais detalhe pode precisar de ajuste desse orçamento pelo Director. Presets não impõem resolução/codec nem limitam os viewers solo OBS. Valores avançados prevalecem sobre o preset; clientes conectados precisam aplicar/reconectar após salvar.
- O GM entra inicialmente como guest. O painel permite escolher um GM como Director com `director`, `push` e `showdirector`, no mesmo iframe. O Director inicia em **Scene Preview** (`previewmode`); um aviso explica o botão **🪟 Toggle Director Vision**, que alterna entre a cena e o painel de direção. O VDO.Ninja controla admissão e poderes de Director; papéis Foundry não são uma autenticação externa.
- Label usa sempre o nome Foundry. Usuários sem slot não entram. Slots não são recriados ao recarregar; trocar Room, senha ou slot muda os links OBS e precisa ser uma escolha do GM.
- Room IDs: 1–49 letras/números; Stream IDs: 1–64 letras/números/underscore. Parâmetros adicionais limitados a `password`, `roombitrate`, `totalroombitrate`, `videobitrate`, `codec`, `width`, `height`, `fps`, `maxframerate`, `structure` e `cover`. Não use URL completa ou fragmento no campo. O módulo rejeita parâmetros que substituam identidade, papel, transporte ou interface, exceto o layout nativo explicitamente permitido.
- Foundry deve estar em HTTPS ou localhost. Atributo `allow` do iframe não sobrepõe bloqueios de Permissions-Policy/CSP no servidor. O módulo preserva o contexto de origem e a UI oficial, sem sandbox que inviabilize câmera ou menus.

Alternativa para reabrir o dock por macro **Script**:

```js
game.modules.get("rpgup-vdo-ninja").api.openDock();
```

## Layout nativo das câmeras no dock

No painel **World / OBS → Layout das câmeras**, **Padrão VDO.Ninja** não adiciona parâmetros de layout (também é o padrão para configurações antigas). **Compacto / preencher espaço** adiciona somente `cover` à URL da Room de cada participante, inclusive ao preview do GM Director. Salve e use **Aplicar / reconectar** em cada cliente conectado. O parâmetro preenche a área atribuída a cada câmera por recorte; pode cortar laterais, topo/baixo e alterar o enquadramento do self-preview. Não é ajuste de bitrate, resolução ou qualidade.

O teste inicial pedido, `structure&cover`, está disponível em **Parâmetros avançados**: selecione **Padrão VDO.Ninja** e informe `structure&cover`, preservando os outros parâmetros já usados pela mesa. Flags sem valor são aceitas; a URL pode serializá-las como `structure=&cover=`, equivalente para o VDO. Para comparar com Compacto, remova `structure` dos avançados. Escolher Padrão não apaga parâmetros avançados; para restaurar o layout padrão, remova também `cover`/`cover=2` desse campo.

Por que Compacto usa apenas `cover`: na prova com o renderizador oficial 31.1, duas demonstrações nativas 16:9 em 360×760 ficaram em contêineres de 360×203 dentro de áreas de 360×380, tanto no padrão quanto com `structure&cover`. Com `cover` sozinho, cada contêiner ocupou 360×380 por recorte. `structure` fixa a proporção do contêiner e pode manter o vazio ao redor. Fontes: [structure](https://docs.vdo.ninja/advanced-settings/design-parameters/and-structure), [cover](https://docs.vdo.ninja/advanced-settings/mixer-scene-parameters/cover), [renderizador oficial](https://github.com/steveseguin/vdo.ninja/blob/master/lib.js).

Validação explícita: `structure` aceita apenas valor vazio; `cover` aceita vazio ou `2` (variante nativa que recorta somente horizontalmente). Valores como `structure=0`/`cover=false` são rejeitados: o VDO ainda os habilita por presença. Duplicatas continuam proibidas. [rows](https://docs.vdo.ninja/advanced-settings/design-parameters/and-rows) foi investigado, mas não incluído: força linhas e não adapta uma configuração única às bordas verticais e horizontais; `structure&cover&rows=1,2,3,4` manteve o mesmo vazio no exemplo vertical de duas câmeras.

Essas opções afetam somente a composição local da Room. Não mudam Room ID, Stream IDs, labels, parâmetros do Director, áudio ou solo links/exportação OBS e não criam outro iframe. O módulo continua usando os controles nativos para self-preview, PiP e mini preview. `cover` também muda o estilo do preview local no VDO; a execução de PiP/mini preview com câmera real ainda precisa ser conferida.

**O resultado visual final ainda precisa ser validado em uma Room real do VDO.Ninja dentro do Foundry v14.** Compare Padrão, `structure&cover` e Compacto com 1, 2, 3 e 4 câmeras reais, nas bordas esquerda/direita/topo/embaixo, redimensionando a janela. Registre espaços restantes, recortes aceitáveis e self-preview/mini preview/PiP como jogador e Director. A geração correta de URLs e as demonstrações nativas não comprovam a resolução do problema na mesa.

## Verificação de desenvolvimento

```sh
npm test
npm run check
npm run package
```

Teste opcional de navegador: disponibilize o pacote Playwright no ambiente (ou `PLAYWRIGHT_PACKAGE` apontando para seu `index.mjs`), então execute `npm run test:browser`. `PLAYWRIGHT_CHANNEL=msedge` usa Edge instalado. A fixture usa um substituto do contrato ApplicationV2 e intercepta o iframe: verifica nosso ciclo de UI, **não** câmera/WebRTC nem o runtime real do Foundry.

Teste optativo da UI oficial: `npm run test:official-ui` usa o mesmo Playwright para abrir `https://vdo.ninja/`, conferir a imagem incorporada e alternar o botão real do Director. O teste bloqueia WebSockets e não concede câmera/microfone; não valida transmissão de mídia ou visão entre participantes.

`npm run test:official-layout` compara padrão, `structure&cover`, `cover` e uma sequência `rows` com 1–4 `fakeguests` nativos em áreas vertical/horizontal. Mede contêineres, salva JSON/capturas em `test-results/official-layout` e verifica o parser de Room/mini preview/PiP e o toggle Director. Usa o mesmo Playwright, bloqueia WebSockets e não concede dispositivos. É prova do renderizador e do parser servidos pelo VDO, sem Foundry autenticado ou peers reais.

Para atualizar: saia do World, atualize o módulo no Setup e confirme **1.0.1**. Recarregue os navegadores do GM e dos jogadores (Ctrl+F5). Room, slots e preferências existentes são preservados. Configurações sem layout salvo continuam no padrão VDO.Ninja; para preencher as áreas, selecione **Layout das câmeras → Compacto / preencher espaço**, salve e aplique/reconecte em cada cliente. Não é necessário desinstalar nem gerar novos IDs.

O módulo usa um iframe oficial por cliente e não inclui servidor de mídia, backend, SDK WebRTC, AVClient, controle OBS ou fork. O painel aceita os usuários do World, inclusive mesas com 4–6 participantes; o teste automatizado de seis usuários verifica associação e exportação, não capacidade de mídia da rede. A aprovação do protótipo e a autorização de produção vieram do usuário. Os testes do agente, seus ambientes e limites estão registrados em [PROTOTYPE-RESULTS.md](docs/PROTOTYPE-RESULTS.md).


## Controles compactos e cabeçalho do VDO.Ninja (1.0.6)

Nos modos acoplados à borda, a janela VDO.Ninja não exibe a barra de título do ApplicationV2. Em seu lugar, um **único botão de engrenagem junto aos controles do canvas** reúne as ações Configurações, Recarregar, Desacoplar e Fechar. Esse botão segue o painel quando ele muda de posição ou tamanho. Quando o modo é **Flutuante**, a barra de título normal retorna para permitir arrastar e fechar. Mudar o modo/abrir controles não reinicia o iframe nem a chamada.

No iframe dos participantes, a URL inclui o parâmetro oficial `hideheader`, removendo a faixa “VDO.Ninja / You are in room” sem esconder os controles nativos de câmera, microfone e PiP. O parâmetro é aplicado na próxima conexão ou ao atualizar a sala VDO depois de instalar o módulo. Links solo para OBS continuam inalterados.


## Layout sem margens e ações na aba Configurações (1.0.7)

A janela acoplada agora toca as bordas da tela: sem os vãos anteriores de 8px nas laterais/topo/rodapé ou os 16px extras de reserva na interface. O modo flutuante preserva sua margem externa.

Removido o botão de engrenagem flutuando sobre o canvas. Na **aba Configurações** do Foundry, **Câmeras VDO.Ninja** passa a ser um botão alternador: clique para abrir, clique novamente para fechar. **Opções VDO.Ninja** é um segundo botão nessa mesma área, que abre as opções da dock (e a própria dock se estiver fechada), sem reconectar a câmera ativa. A ação **Recarregar sala VDO** também fica dentro dessas opções; configurações permitem continuar mudando entre dock e janela flutuante. No modo flutuante, a barra de título nativa permanece.


## Janela única de configurações (1.0.8)

A janela **RPGUP VDO.Ninja — Configurações** reúne as guias de sala, participantes, aparência e parâmetros avançados (visíveis somente ao GM) com as guias pessoais **Conexão**, **Janela**, **Avatar** e **Ajuda** (disponíveis para todos os usuários). A dock acoplada ficou apenas com o vídeo e controles nativos do VDO, sem opções que roubem espaço das câmeras. **Opções VDO.Ninja**, na aba Configurações do Foundry, abre e fecha a janela única, sem abrir ou reconectar a dock. **Câmeras VDO.Ninja** continua abrindo/fechando somente a dock. No modo flutuante, o botão de opções na barra de título também abre/fecha a mesma janela.

Preferências pessoais continuam como flags do usuário Foundry. Alterar posição e zoom não interrompe a chamada. Atualizações de avatar ou configurações compartilhadas só entram na chamada ao usar **Aplicar / reconectar** na nova guia Conexão. O mestre continua sendo o único autorizado a salvar Room, participantes, links OBS e configurações do mundo; jogadores visualizam somente guias pessoais.
