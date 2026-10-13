# LISTTA

Aplicativo web instalável para organizar filas e atendimentos escolares do Distrito de Educação 1, com identidade visual laranja e verde.

## Recursos
- Lista inicial de 45 escolas.
- Listas independentes por escola e turno (MANHÃ/TARDE).
- Cadastro manual e importação por colagem ou CSV público do Google Sheets.
- Nomes em MAIÚSCULAS e prevenção de duplicados por escola/data/turno.
- Status EM ESPERA, ATENDIDOS e FALTOU; destaque por estrela e reordenação por arrastar.
- Relatórios por escola, turno e data; impressão pelo navegador para salvar como PDF.
- Persistência local e sincronização Supabase/Realtime.
- Visualizador e login do ADM via Supabase Auth.

## Configuração de publicação
Execute `npm run build` e publique a pasta `dist`.

## Google Sheets
Para importar por link, a planilha precisa permitir leitura pública ou estar publicada na web como CSV. A importação lê a primeira coluna e ignora cabeçalhos comuns. Planilhas privadas exigem autenticação OAuth, não incluída nesta versão.

## Segurança do ADM
O formulário de ADM usa Supabase Auth. A proteção real também depende de políticas RLS no banco. A migração de permissões deve ser aplicada no SQL Editor do Supabase; apenas enviar os arquivos ao GitHub não executa migrações no banco remoto. Desative o cadastro público de usuários e crie a conta do ADM no painel do Supabase.

## Escolas
A lista inicial foi montada a partir dos nomes recuperados dos pedidos anteriores e de referências públicas. Confira a relação com a listagem oficial atual da SME antes do uso institucional. É possível adicionar ou corrigir escolas pelo modo ADM.
