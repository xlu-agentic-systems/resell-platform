export interface StorageEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

export interface LocalStorageResourceOptions<T> {
  key: string;
  version: number;
  defaultValue: T | (() => T);
  storage?: Storage;
  migrate?: (stored: unknown, storedVersion: number) => T;
  validate?: (value: unknown) => value is T;
  onError?: (error: unknown) => void;
}

export interface LocalStorageResource<T> {
  key: string;
  version: number;
  load: () => T;
  save: (value: T) => StorageEnvelope<T>;
  reset: () => StorageEnvelope<T>;
  clear: () => void;
}

export function createLocalStorageResource<T>(
  options: LocalStorageResourceOptions<T>,
): LocalStorageResource<T> {
  const getDefaultValue = () =>
    typeof options.defaultValue === "function"
      ? (options.defaultValue as () => T)()
      : options.defaultValue;

  const getStorage = () => options.storage ?? getBrowserLocalStorage();

  const handleError = (error: unknown) => {
    if (options.onError) {
      options.onError(error);
    }
  };

  const resource: LocalStorageResource<T> = {
    key: options.key,
    version: options.version,
    load() {
      const storage = getStorage();

      if (!storage) {
        return getDefaultValue();
      }

      try {
        const raw = storage.getItem(options.key);
        if (!raw) {
          return getDefaultValue();
        }

        const envelope = JSON.parse(raw) as Partial<StorageEnvelope<unknown>>;
        const storedVersion =
          typeof envelope.version === "number" ? envelope.version : 0;

        if (storedVersion !== options.version) {
          return options.migrate
            ? options.migrate(envelope.data, storedVersion)
            : getDefaultValue();
        }

        if (options.validate && !options.validate(envelope.data)) {
          return getDefaultValue();
        }

        return envelope.data as T;
      } catch (error) {
        handleError(error);
        return getDefaultValue();
      }
    },
    save(value) {
      const envelope: StorageEnvelope<T> = {
        version: options.version,
        savedAt: new Date().toISOString(),
        data: value,
      };
      const storage = getStorage();

      if (!storage) {
        return envelope;
      }

      try {
        storage.setItem(options.key, JSON.stringify(envelope));
      } catch (error) {
        handleError(error);
      }

      return envelope;
    },
    reset() {
      return resource.save(getDefaultValue());
    },
    clear() {
      const storage = getStorage();

      if (!storage) {
        return;
      }

      try {
        storage.removeItem(options.key);
      } catch (error) {
        handleError(error);
      }
    },
  };

  return resource;
}

function getBrowserLocalStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
