import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthPortalHub } from '@/components/auth/auth-portal-hub';
import { searchParamsRecordToQueryString } from '@/lib/search-params-to-query-string';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterHubPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const redirectQuery = searchParamsRecordToQueryString(sp);
  return (
    <AuthPageShell>
      <AuthPortalHub flow="register" redirectQuery={redirectQuery} />
    </AuthPageShell>
  );
}
