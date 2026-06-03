async function uzaBordroComparePayload(opts) {
  const path = `/messaging/bordro/compare${uzaBordroSchoolQ(opts.schoolId)}`;
  return uzaFetchJson(path, {
    method: 'POST',
    token: opts.token,
    body: {
      mebbisJson: JSON.stringify({ headers: opts.mebbis.headers, rows: opts.mebbis.rows }),
      kbsJson: JSON.stringify({ headers: opts.kbs.headers, rows: opts.kbs.rows }),
    },
  });
}

async function uzaBordroTcAudit(opts) {
  const path = `/messaging/bordro/tc-audit${uzaBordroSchoolQ(opts.schoolId)}`;
  return uzaFetchJson(path, {
    method: 'POST',
    token: opts.token,
    body: {
      headers: JSON.stringify(opts.headers),
      rows: JSON.stringify(opts.rows),
    },
  });
}
