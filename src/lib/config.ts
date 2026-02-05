import { z } from "zod";

const configSchema = z.object({});

export type Config = z.infer<typeof configSchema>;

const CONFIG_PATH = Bun.env.HOME + "/.juno/juno.json";
const CONFIG_POLL_MS = 1000;

async function loadConfig(): Promise<Config> {
  const file = Bun.file(CONFIG_PATH);

  if (await file.exists()) {
    const raw = await file.json();
    return configSchema.parse(raw);
  }

  const defaults = configSchema.parse({});
  await Bun.write(CONFIG_PATH, JSON.stringify(defaults, null, 2) + "\n");
  return defaults;
}

export let config = await loadConfig();

let lastModified = 0;

async function refreshLastModified(): Promise<number> {
  const file = Bun.file(CONFIG_PATH);
  if (await file.exists()) {
    return file.lastModified;
  }
  return 0;
}

async function reloadConfigFromDisk(): Promise<void> {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      const raw = await file.json();
      config = configSchema.parse(raw);
      lastModified = file.lastModified;
      return;
    }

    config = await loadConfig();
    lastModified = await refreshLastModified();
  } catch (error) {
    console.error("Failed to reload config. Keeping existing values.", error);
  }
}

lastModified = await refreshLastModified();

const configWatcher = setInterval(async () => {
  const file = Bun.file(CONFIG_PATH);
  const exists = await file.exists();
  const nextModified = exists ? file.lastModified : 0;

  if (nextModified !== lastModified) {
    await reloadConfigFromDisk();
  }
}, CONFIG_POLL_MS);

configWatcher.unref?.();
