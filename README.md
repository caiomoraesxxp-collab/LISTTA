# LISTTA

Aplicativo web instalável para organizar filas de alunos e atendimentos escolares do Distrito de Educação 1, com identidade visual laranja e verde.

## Funcionalidades presentes nesta versão

- Catálogo inicial de 45 escolas, incluindo as três EMTI.
- Pesquisa de escolas e seleção de listas independentes por escola, data e turno MANHÃ/TARDE.
- Inclusão manual de alunos e importação por colagem, CSV e link de Google Sheets com acesso de leitura.
- Nomes apresentados em MAIÚSCULAS.
- Status: NÃO CHEGOU, ATENDIDO, FALTOU e FOI EMBORA.
- Reordenação por arrastar e soltar, destaque por estrela e remoção de alunos.
- Relatórios por escola e data, resumo geral e impressão do navegador para salvar em PDF.
- Login do administrador pelo Supabase Auth (a conta precisa existir no projeto Supabase).
- Arquivos básicos de PWA e cache offline do shell do aplicativo.
- Esquema inicial do banco e políticas RLS em [supabase/schema.sql](supabase/schema.sql).

## Executar localmente

1. Instale Node.js LTS.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm run dev` para desenvolvimento ou `npm run build` para gerar `dist/`.
4. Publique a pasta `dist` em um serviço estático que ofereça HTTPS.

## Supabase: configuração necessária

O HTML contém as configurações públicas de URL e chave anon do Supabase. Confirme que apontam para o projeto correto antes de publicar. A chave anon não substitui políticas de segurança.

1. Abra o SQL Editor do projeto Supabase correto.
2. Revise e execute `supabase/schema.sql`.
3. Ative Realtime para as tabelas `schools` e `people`.
4. Crie a conta do administrador em Authentication.
5. Configure a claim confiável `app_metadata.role = admin` para o administrador por mecanismo administrativo seguro.
6. Desative o cadastro público se não for necessário.
7. Teste as políticas RLS e a sincronização com contas distintas antes de inserir dados reais.

**Importante:** o SQL cria tabelas e políticas básicas para o esquema atual; não cria automaticamente distritos, perfis de visualizador ou uma política de isolamento entre seis distritos. Esses recursos ainda precisam ser implementados antes de uso multi-distrito ou institucional. Não utilize dados reais de alunos até concluir a revisão de segurança.

## Google Sheets

A importação por link funciona quando a planilha está publicada como CSV ou tem acesso de leitura permitido. Planilhas privadas exigem OAuth/Google Sheets API, que não está incluído nesta versão. Também é possível colar os nomes diretamente no campo de importação.

## Limitações conhecidas desta versão

- O modo offline armazena os arquivos da interface em cache; alterações offline ainda não possuem uma fila transacional robusta de sincronização.
- O modelo de dados atual não implementa isolamento completo por distrito nem perfis de visualizador no backend.
- A seleção do médico é registrada por aluno, não como vínculo formal da sessão.
- A geração de PDF usa a impressão do navegador; não há arquivo PDF histórico armazenado automaticamente.
- Confirme a lista de escolas com a relação oficial atual da SME antes do uso institucional.

## Segurança

Não inclua credenciais secretas no repositório. Use autenticação, políticas RLS, HTTPS e permissões mínimas. O projeto deve passar por testes de autorização e sincronização antes de ser utilizado com dados pessoais de alunos.
