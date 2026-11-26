# Revisão de segurança antes da publicação

Data: 26/11/2026. Escopo: arquivos do primeiro commit, configuração Django, autenticação REST/OAuth/MCP, armazenamento de sessão mobile/web e ferramentas locais. Revisão estática com testes automatizados; não é um pentest nem uma certificação de produção.

## Resultado

Nenhuma credencial real foi identificada nos candidatos ao commit pela varredura de padrões, pelo Gitleaks 8.30.1 ou pela comparação exata com os valores secretos de `backend/.env` e `mobile/.env.local`. Os valores não são exibidos nos relatórios. Senhas literais nas fixtures são dados sintéticos exclusivos dos testes.

O projeto principal não tinha histórico Git. O histórico separado do template mobile foi preservado em `.local/mobile-git-backup`, fora do repositório; seus commits não serão publicados. O primeiro commit inclui o código mobile como arquivos normais.

## Medidas aplicadas

- `.gitignore` exclui ambientes reais, cluster PostgreSQL, backups, bancos, logs, artefatos, relatórios de navegador, certificados e chaves de assinatura. Os arquivos locais foram preservados.
- `.env.example` permanece versionado com os campos secretos vazios.
- `scripts/check_secrets.py` verifica arquivos versionados e candidatos novos, sem imprimir valores encontrados. A comparação com segredos locais só acontece quando esses arquivos existem na máquina.
- A documentação de entrada foi reescrita com instalação reproduzível, limites do produto e separação entre demonstração e conta real. Referências ao caminho pessoal e ao IP específico foram removidas dos guias operacionais.
- O repositório será privado. Não é permitido colocar credenciais no frontend, inclusive em `EXPO_PUBLIC_*`.

## Controles observados

- `backend/config/settings.py:13`: `SECRET_KEY = required("SECRET_KEY")`; sem chave de fallback no código da aplicação.
- `backend/config/environment.py:16`: ausência de configuração obrigatória produz erro; senhas do banco vêm do ambiente.
- `backend/config/settings.py:60`: API autenticada por padrão; serviços filtram objetos pelo usuário e mantêm idempotência/auditoria.
- `mobile/src/lib/api.ts:30`: tokens persistidos via SecureStore somente no aplicativo nativo; web conserva a sessão em memória.
- `backend/config/public_settings.py:22`: processo público desliga DEBUG e habilita cookies seguros. A fronteira pública permite somente rotas MCP/OAuth.
- Verificador MCP checa hash do token pessoal ou OAuth, expiração, revogação e escopos antes de executar comandos.

## Achados e limites

### SEC-01 — Média, condicional à implantação com múltiplos processos

Local: `backend/integrations/oauth.py:97` e `backend/config/settings.py`.

Evidência: os limites OAuth usam `cache.add` e `cache.incr`; não há cache compartilhado configurado. O cache local padrão não compartilha contadores entre processos. Isso pode multiplicar o número de tentativas permitido ao escalar a aplicação.

Correção recomendada para produção: configurar cache compartilhado e limites no proxy, e testar concorrência entre workers. O ambiente local atual usa um processo; nenhuma credencial foi exposta por esse achado. Não foi alterada a infraestrutura durante esta publicação.

### SEC-02 — Baixa, exposição na rede de desenvolvimento

Local: `scripts/Start-LifeGoals.ps1:39` e `backend/.env.example:1`.

Evidência: o launcher atende em `0.0.0.0` e o exemplo de desenvolvimento habilita DEBUG. Isso permite usar o celular no Wi-Fi, mas HTTP e páginas de erro de desenvolvimento são inadequados para redes não confiáveis.

Mitigação: usar somente rede confiável e restringir firewall; em produção, usar HTTPS, DEBUG desativado e configuração própria. O processo público MCP já possui configurações separadas. O comportamento LAN necessário ao desenvolvimento foi preservado.

## Verificações

- Backend: 69 testes aprovados, 2 testes de navegador pulados por exigirem execução explícita; um aviso de depreciação do cliente de testes Starlette.
- Django system check sem problemas; nenhuma migração pendente de geração.
- Ruff lint e formatação aprovados após organização de imports e formatação.
- Mobile: TypeScript e lint aprovados; 23 testes aprovados.
- Candidatos ao commit: scanner próprio sem achados e Gitleaks sem vazamentos.
- Regras de exclusão conferidas para ambientes reais, backups, capturas e relatórios.

Não foram executados nesta revisão: suíte completa de navegador, build nativo, auditoria de vulnerabilidades das dependências, pentest, restauração de backup ou testes de concorrência PostgreSQL. Scanners podem deixar passar formatos desconhecidos de segredo. Antes de publicar alterações futuras, repetir a verificação e revisar o conteúdo do stage.

## Rotina antes de enviar mudanças

```powershell
python scripts/check_secrets.py
git diff --cached --check
git diff --cached --stat
```

Se uma credencial real entrar em um commit enviado, revogue ou rotacione primeiro. Remover apenas o arquivo no commit seguinte não remove o segredo do histórico.
