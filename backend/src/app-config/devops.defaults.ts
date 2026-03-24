/** Süper yönetici — Git / canlı ortam referans bilgileri (gizli anahtar saklamayın). */
export type DevOpsConfig = {
  git_repo_url: string | null;
  git_default_branch: string | null;
  cicd_url: string | null;
  production_api_url: string | null;
  production_web_url: string | null;
  deploy_notes: string | null;
};

export const DEFAULT_DEVOPS: DevOpsConfig = {
  git_repo_url: null,
  git_default_branch: 'main',
  cicd_url: null,
  production_api_url: null,
  production_web_url: null,
  deploy_notes: null,
};

export function mergeDevOpsFromStored(stored: Partial<DevOpsConfig> | null | undefined): DevOpsConfig {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_DEVOPS };
  return {
    ...DEFAULT_DEVOPS,
    ...stored,
    git_repo_url: stored.git_repo_url != null ? String(stored.git_repo_url) : null,
    git_default_branch: stored.git_default_branch != null ? String(stored.git_default_branch) : null,
    cicd_url: stored.cicd_url != null ? String(stored.cicd_url) : null,
    production_api_url: stored.production_api_url != null ? String(stored.production_api_url) : null,
    production_web_url: stored.production_web_url != null ? String(stored.production_web_url) : null,
    deploy_notes: stored.deploy_notes != null ? String(stored.deploy_notes) : null,
  };
}
