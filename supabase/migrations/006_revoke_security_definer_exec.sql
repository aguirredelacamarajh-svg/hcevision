-- Seguridad: las funciones SECURITY DEFINER no deben ser ejecutables vía la
-- API REST (/rest/v1/rpc/...). handle_new_user y rls_auto_enable son triggers
-- internos: ningún rol de la API necesita ejecutarlas directamente.
-- (Hallazgo de los advisors de Supabase, lints 0028/0029.)

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
