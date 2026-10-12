# Histórico de versões

## 1.0.11 — 12/10/2026

- Corrige o contraste visual em **tema claro** do Foundry v13/v14: barra de guias, ícones ativos, dropdowns, rodapé de configuração, mensagens de ajuda, entradas e controles de áudio seguem a paleta adequada ao tema.
- Remove fundos escuros forçados de navegação, `select` e rodapé; os menus nativos respeitam `color-scheme` claro/escuro e exibem texto legível, inclusive opções desabilitadas.
- Melhora a leitura das caixas de seleção, rótulos, parâmetros avançados, participantes e tooltips. Mantém a identidade dourada do RPGUP e o painel de câmera VDO como estava.
- Testes em navegador simulam **Foundry Dark e Light**, avaliam contraste de texto na guia de áudio, menus, botão ativo e rodapé e geram capturas nas demais guias. Alternar a paleta não deve alterar as configurações do mundo nem reconectar a sala.
- **Somente CSS e teste visual**: nenhuma mudança na lógica de áudio, câmera, nomes, Stream IDs, Room, links externos, exportação OBS ou limite anti-414.


## 1.0.10 — 11/10/2026

- Nova guia **Tratamento de áudio**, com permissão de edição exclusiva para o GM: perfis Voz limpa (padrão), Redução reforçada, Desligado e Personalizado.
- **Voz limpa** usa filtros nativos VDO.Ninja: denoise=1, echocancellation=1 e autogain=1; sem noise gate ou compressor agressivo.
- **Reforçado** adiciona noisegate=1, compressor=1 e lowcut=100. O noise gate pode cortar o início de frases; é opcional, nunca padrão.
- **Personalizado** permite ligar/desligar redução de ruído, cancelamento de eco, ganho automático, noise gate e compressor, além de corte de graves em frequências validadas.
- Tratamento só vai para os links de **publicação do participante** quando o mestre usa áudio VDO. Salas que já usam Discord permanecem com noaudio e audiodevice=0, sem ligar microfone nem aplicar os filtros.
- Links externos do jogador seguem as mesmas opções salvas; fontes solo OBS continuam inalteradas. Stream IDs, nomes, avatares, Room e proteções contra HTTP 414 preservados.
- Configurações antigas sem audioFilters migram implicitamente para o perfil Voz limpa, mas sem alteração no modo Discord; só são persistidas ao salvar a configuração.
- Sem ponte de chat VDO → Foundry nesta versão. A API permite avaliar isso numa melhoria independente.

**Limites:** filtros de navegador não equivalem ao Krisp do Discord. O VDO usa a disponibilidade de recursos do navegador/dispositivo; reconexão dos participantes é necessária para aplicar o perfil. Validar com microfones reais antes de substituir o Discord na mesa.


## 1.0.9 — 11/10/2026

- Temas Sci-fi e Neon com brilho mais visível nas cores individuais dos usuários Foundry; preserva o teto de URL implementado na v1.0.5.
- Aba Aparência com prévia de câmera, nome de exemplo e troca imediata do tema, incluindo uma simulação local de fala sem abrir câmera ou microfone.
- Usa o contorno de fala oficial do VDO com meterstyle=2 (antes, meterstyle=4 não desenhava destaque). Apenas no áudio VDO, quando o tema está ligado. Áudio pelo Discord não detecta fala dentro do VDO.Ninja.
- Aba Avançado oferece um catálogo dos parâmetros oficiais comuns já autorizados, tooltip explicativo, validação de valor e adição/remoção, mantendo o campo manual para usuários experientes.
- Configurações e slots anteriores, links de entrada, exportação OBS, nomes do Foundry e comportamento da conexão permanecem inalterados. O editor avançado não salva automaticamente.

**Importante:** comportamento visual dentro do VDO real precisa de validação com câmera e áudio reais; os testes automatizados isolam mídia externa.


## 1.0.5 — 09/10/2026 (correção crítica)

- Corrige a regressão **414 Request-URI Too Large** da v1.0.4: CSS de temas e avatares WebP codificados juntos ultrapassavam o limite de requisição HTTP do nginx.
- Define um **limite máximo de 6.900 caracteres** para a URL inteira do VDO, incluindo dados de avatar, Room, IDs, nomes, senhas e temas; cria orçamento calculado individualmente para cada avatar.
- Compacta significativamente o CSS e evita repetir seletores por jogador. Em mundos muito grandes, o tema é omitido automaticamente se ameaçar a conexão; nomes permanecem visíveis.
- Imagem WebP usa a maior resolução/qualidade que caiba na URL. Se não houver espaço para a miniatura, prioriza abrir a chamada com avatar padrão VDO, em vez de receber erro 414.
- Corrige os links externos copiados no painel do mestre usando o mesmo cálculo seguro de tamanho.
- Atualiza os testes para reprovar qualquer URL acima de 6.900 caracteres, inclusive com avatares enormes e muitos participantes.


## 1.0.4 — 09/10/2026

- Mostra automaticamente o nome do usuário do Foundry sobre cada câmera (label já existia; showlabels=rounded agora ativa a visualização).
- Nova guia **Aparência** em Configurar mesa: temas **Sci-fi, Moderno, Neon, Rústico, Fantástico** ou **Sem bordas**, escolhidos pelo GM para a Room; Moderno com borda discreta é o novo padrão. Todos usam a cor configurada no perfil de usuário Foundry para a moldura do respectivo Stream ID.
- Bordas podem engrossar de 2px a 3/4px quando VDO.Ninja detecta fala pelo atributo data-speaking; isso depende de o áudio funcionar **dentro do VDO**. No modo Discord (noaudio) não há detecção de voz e nenhuma nova permissão de microfone é solicitada.
- O CSS é enviado no formato base64css oficial do VDO.Ninja; as fontes OBS em modo solo continuam sem essa aparência.
- Avatares ao desligar câmera tentam agora até 640px e maior qualidade WebP com orçamento limitado de 15 KB para evitar miniaturas minúsculas. Links de navegador externo recebem os mesmos avatares preparados. Imagens muito complexas podem exigir arquivo mais leve.
- Validação de temas, nomes/cores e regressões do Foundry documentadas por testes automatizados. Nomes e Stream IDs existentes não são alterados.

**Limite:** as classes do DOM interno do VDO são controladas pelo serviço externo; verifique cores de cada borda e atividade de voz com participantes reais após a atualização.


## 1.0.3 — 08/10/2026

- **Guias com ícones e tooltips** na dock e no painel Configurar mesa, em vez de painéis longos empilhados. Primeira guia da dock mostra **Configurar mesa** (para GM) antes de Aplicar / reconectar.
- **Tour guiado** acessível pelo ícone de bússola nas duas janelas, com navegação Anterior/Próximo/Concluir, explicações breves e destaque do controle explicado.
- **Room ID sugerida** a partir do título do mundo Foundry quando ainda estiver vazia: remove espaços, acentos e caracteres não permitidos, respeitando os 49 caracteres. Não substitui uma sala salva.
- Botão **World / OBS** renomeado para **Configurar mesa**; janela e menu do Foundry usam o mesmo nome.
- As configurações, preferências, slots, exportação OBS e links de entrada externa continuam preservados. Nenhuma alteração no runtime do Foundry nem reinício de servidor.


## 1.0.2 — 08/10/2026

- Dock à esquerda por padrão. Preferências antigas no modo flutuante migram uma única vez para a esquerda; escolhas de borda existentes são preservadas, assim como novas escolhas salvas na versão 3 das preferências.
- Menu nativo de posição ganha fundo escuro e contraste explícito. Mensagem de Room não configurada fica no fluxo normal, sem sobrepor as opções.
- Coluna **Entrar pelo navegador** no painel World / OBS: link de publicação individual com mesma Room, nome, Stream ID estável, parâmetros de áudio e avatar incorporado (quando acessível). Botão para copiar por jogador; usa somente configuração salva. Não confundir com solo link OBS, que apenas visualiza.
- GitHub Actions valida testes e constrói release com `module.json` e `rpgup-vdo-ninja.zip` nos Assets. O manifest na main acompanha a versão; o ZIP vem do Release versionado.

**Atenção:** links externos podem conter a senha da Room e devem ser enviados somente ao jogador destinatário. Antes de entrar externamente, feche a dock embutida para não publicar duas vezes no mesmo slot. Se a imagem não puder ser lida pelo GM, o link informa fallback para o avatar padrão VDO.


## 1.0.1 — 01/10/2026

- PR #5 incorporado à main: opção GM **Compacto / preencher espaço** usa `cover` nativo somente na Room; `structure` e `cover` sem valor e `cover=2` são permitidos explicitamente nos avançados.
- Manifest e download atualizados para a branch de distribuição `v1.0.1`, com o mesmo endereço de atualização na main e compatibilidade Foundry v13/v14.
- Arquitetura e implementação do PR preservadas. Room, IDs, labels, áudio e links OBS não mudam. Configurações antigas continuam no layout padrão até selecionar Compacto.

33 testes unitários e provas de fixture/renderizador documentadas no PR. O recorte de `cover` e o resultado visual com câmeras reais ainda precisam ser validados no Foundry v14; publicação não substitui essa prova.

## 1.0.0 — 01/10/2026

Primeira versão de produção, após aprovação expressa do protótipo pelo usuário. Foundry v13/v14; manifest mínimo 13, verificado 14 e máximo 14.

- Reload da sala no cabeçalho: recarrega somente o iframe atual e preserva rascunhos do GM, Room e ID.
- Botão Câmeras VDO.Ninja na sidebar Configurações para reabrir a janela.
- Opções em grupos, tooltips, foco visível, controles com ícones e layout responsivo também ao estreitar a própria janela.
- Painel GM com Room, áudio, Director, qualidade e participantes. Parâmetros avançados recolhidos; status e botão de salvar fixos na parte inferior.
- Presets opcionais de qualidade, sem resolução ou codec obrigatório. Opções avançadas têm prioridade.
- Avatar opcional por usuário definido pelo GM para a mesa, com fallback para User.avatar e preferências individuais preservadas.
- Exportação organizada dos links solo OBS em JSON, baseada na configuração salva.
- Artefato versionado pela branch de distribuição v1.0.0. Instalação e atualização pelo mesmo manifest na main.

Room, senha/parâmetros, Stream IDs, links OBS e preferências existentes são preservados. A configuração antiga usa preset automático e nenhum avatar adicional. Não é preciso desinstalar nem gerar slots novamente.

## 0.1.0-prototype.3

Director em Scene Preview, opções recolhidas pela engrenagem no cabeçalho, tooltips e avatar estático incorporado para contornar CORS. Removidos seletores redundantes de câmera, PC/Móvel e self-preview.

## 0.1.0-prototype.2

Geração e salvamento explícitos de slots, rascunhos preservados, sincronização de jogadores aguardando associação, dock flutuante por padrão, reserva da UI nas bordas e zoom local.

## 0.1.0-prototype.1

Room oficial VDO.Ninja em ApplicationV2, IDs estáveis por usuário, dock em cinco posições e solo links OBS.
