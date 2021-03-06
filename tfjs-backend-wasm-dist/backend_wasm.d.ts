/**
 * @license
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import { backend_util, BackendTimingInfo, DataStorage, DataType, KernelBackend, TensorInfo } from '@tensorflow/tfjs-core';
import { BackendWasmModule } from '../wasm-out/tfjs-backend-wasm';
interface TensorData {
    id: number;
    memoryOffset: number;
    shape: number[];
    dtype: DataType;
    /** Only used for string tensors, storing encoded bytes. */
    stringBytes?: Uint8Array[];
}
export declare type DataId = object;
export declare class BackendWasm extends KernelBackend {
    wasm: BackendWasmModule;
    private dataIdNextNumber;
    dataIdMap: DataStorage<TensorData>;
    constructor(wasm: BackendWasmModule);
    write(values: backend_util.BackendValues, shape: number[], dtype: DataType): DataId;
    numDataIds(): number;
    time(f: () => void): Promise<BackendTimingInfo>;
    move(dataId: DataId, values: backend_util.BackendValues, shape: number[], dtype: DataType): void;
    read(dataId: DataId): Promise<backend_util.BackendValues>;
    readSync(dataId: DataId): backend_util.BackendValues;
    disposeData(dataId: DataId): void;
    floatPrecision(): 32;
    getMemoryOffset(dataId: DataId): number;
    dispose(): void;
    memory(): {
        unreliable: boolean;
    };
    /**
     * Make a tensor info for the output of an op. If `memoryOffset` is not
     * present, this method allocates memory on the WASM heap. If `memoryOffset`
     * is present, the memory was allocated elsewhere (in c++) and we just record
     * the pointer where that memory lives.
     */
    makeOutput(shape: number[], dtype: DataType, memoryOffset?: number): TensorInfo;
    typedArrayFromHeap({ shape, dtype, dataId }: TensorInfo): backend_util.TypedArray;
}
/**
 * Initializes the wasm module and creates the js <--> wasm bridge.
 *
 * NOTE: We wrap the wasm module in a object with property 'wasm' instead of
 * returning Promise<BackendWasmModule> to avoid freezing Chrome (last tested in
 * Chrome 76).
 */
export declare function init(): Promise<{
    wasm: BackendWasmModule;
}>;
/**
 * Sets the path to the `.wasm` file which will be fetched when the wasm
 * backend is initialized. See
 * https://github.com/tensorflow/tfjs/blob/master/tfjs-backend-wasm/README.md#using-bundlers
 * for more details.
 */
/** @doc {heading: 'Environment', namespace: 'wasm'} */
export declare function setWasmPath(path: string): void;
/** Used in unit tests. */
export declare function resetWasmPath(): void;
export {};
