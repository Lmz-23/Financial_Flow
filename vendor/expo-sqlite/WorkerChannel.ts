// Copia de expo-sqlite@56.0.5 web/WorkerChannel.ts (MIT, (c) 650 Industries, Inc. / Expo) con dos
// cambios marcados como PARCHE (sendWorkerResult e invokeWorkerSync); siguen sin corregir en 58.0.14.
// metro.config.js la usa en lugar del original solo en web. Al actualizar expo-sqlite, revisar si el
// original ya lo corrige y borrar esta copia.

const SYNC_TIMEOUT_MS = 30_000;

// Copyright 2015-present 650 Industries. All rights reserved.

import { Deferred } from './Deferred';
import { serialize, deserialize } from './SyncSerializer';
import {
  type SQLiteWorkerMessageType,
  type MessageTypeMap,
  type ResultType,
  type ResultTypeMap,
} from './web.types';

let messageId = 0;
const deferredMap = new Map<number, Deferred>();
const PENDING = 1;
const RESOLVED = 2;

let hasWarnedSync = false;

/**
 * For worker to send result to the main thread.
 */
export function sendWorkerResult({
  id,
  result,
  error,
  syncTrait,
}: {
  id: number;
  result: ResultType | null;
  error: Error | null;
  syncTrait?: {
    lockBuffer: SharedArrayBuffer;
    resultBuffer: SharedArrayBuffer;
  };
}) {
  if (syncTrait) {
    const { lockBuffer, resultBuffer } = syncTrait;
    const lock = new Int32Array(lockBuffer);
    const resultArray = new Uint8Array(resultBuffer);
    const resultJson = error != null ? serialize({ error }) : serialize({ result });
    const resultBytes = new TextEncoder().encode(resultJson);
    const length = resultBytes.length;
    // PARCHE: el original hacia `resultArray.set(new Uint32Array([length]), 0)`, que copia el
    // numero a UN solo byte (Uint8Array): toda respuesta de mas de 255 bytes llegaba truncada y
    // fallaba con "Unterminated string in JSON". Se escribe como entero de 32 bits, que es como
    // lo lee `invokeWorkerSync`.
    new Uint32Array(resultBuffer, 0, 1)[0] = length;
    resultArray.set(resultBytes, 4);
    Atomics.store(lock, 0, RESOLVED);
  } else {
    if (result) {
      self.postMessage({ id, result });
    } else {
      self.postMessage({ id, error });
    }
  }
}

/**
 * For main thread to handle worker messages.
 */
export function workerMessageHandler(event: MessageEvent) {
  const { id, result, error, isSync } = event.data;
  if (!isSync) {
    const deferred = deferredMap.get(id);
    if (deferred) {
      if (error) {
        deferred.reject(new Error(error));
      } else {
        deferred.resolve(result);
      }
      deferredMap.delete(id);
    }
  }
}

/**
 * For main thread to invoke worker function asynchronously.
 */
export async function invokeWorkerAsync<T extends SQLiteWorkerMessageType & keyof ResultTypeMap>(
  worker: Worker,
  type: T,
  data: MessageTypeMap[T]['data']
): Promise<ResultTypeMap[T]> {
  const id = messageId++;
  const deferred = new Deferred<ResultTypeMap[T]>();
  deferredMap.set(id, deferred);
  worker.postMessage({ type, id, data, isSync: false });
  return deferred.getPromise();
}

/**
 * For main thread to invoke worker function synchronously.
 */
export function invokeWorkerSync<T extends SQLiteWorkerMessageType & keyof ResultTypeMap>(
  worker: Worker,
  type: T,
  data: MessageTypeMap[T]['data']
): ResultTypeMap[T] {
  if (__DEV__ && !hasWarnedSync) {
    console.warn(
      'Using synchronous SQLite operations can cause significant performance impact. Consider using async operations instead.'
    );
    hasWarnedSync = true;
  }

  const id = messageId++;
  const lockBuffer = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockBuffer);
  const resultBuffer = new SharedArrayBuffer(1024 * 1024);
  const resultArray = new Uint8Array(resultBuffer);

  Atomics.store(lock, 0, PENDING);
  worker.postMessage({
    type,
    id,
    data,
    isSync: true,
    lockBuffer,
    resultBuffer,
  });

  // PARCHE: limite por tiempo real en vez de 1.000.000 de vueltas. La duracion de Atomics.pause
  // depende del CPU (unos 200 ms en un i5 moderno, pocos ms en CPUs viejas), y la primera
  // operacion, mientras el worker carga el WASM, fallaba con "Sync operation timeout".
  const deadline = performance.now() + SYNC_TIMEOUT_MS;
  let i = 0;
  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
  const useAtomicsPause = typeof Atomics.pause === 'function';
  while (Atomics.load(lock, 0) === PENDING) {
    if (++i % 1024 === 0 && performance.now() > deadline) {
      throw new Error('Sync operation timeout');
    }
    if (useAtomicsPause) {
      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
      Atomics.pause();
    }
  }

  const length = new Uint32Array(resultArray.buffer, 0, 1)[0];
  const resultCopy = new Uint8Array(length);
  resultCopy.set(new Uint8Array(resultArray.buffer, 4, length));
  const resultJson = new TextDecoder().decode(resultCopy);
  const { result, error } = deserialize<{ result: ResultTypeMap[T]; error?: string }>(resultJson);
  if (error) throw new Error(error);
  return result;
}
