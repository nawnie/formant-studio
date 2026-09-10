const base = `http://127.0.0.1:${Number(process.env.FORMANT_PORT || 4317)}`;
try {
  const health = await (
    await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })
  ).json();
  if (health.app !== "formant-studio")
    throw new Error("The listener is not FORMANT; left untouched.");
  await fetch(`${base}/api/shutdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  console.log("FORMANT studio stopped. Your saved session is retained.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
