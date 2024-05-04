import { Denops } from "https://deno.land/x/denops_core@v6.0.5/mod.ts";
import {
  ensure,
  is,
  Predicate,
  PredicateType,
} from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

export const isArgs = is.RecordOf(is.Unknown, is.String);
export type Args = PredicateType<typeof isArgs>;

// A marker instead of the func-name to specify args cross all functions.
export type CrossFunc = "_";

export class ArgStore {
  #store = new Map<string | CrossFunc, Args>();

  /**
   * Set an arg value for a function (or cross all functions).
   * @param {string} func - Target function name or "_" to cross all functions.
   * @param {string} arg - Target arg name.
   * @param {unknown} value
   */
  public setFuncArg(
    func: string | CrossFunc,
    arg: string,
    value: unknown,
  ) {
    const args = this.#store.get(func) || {};
    args[arg] = value;
    this.#store.set(func, args);
  }

  /**
   * Make a dispatcher to set an arg value for a function (or cross all functions).
   * @example
   * ```ts
   * const argStore = new ArgStore();
   * denops.dispatcher = {
   *   customSetFuncArg: argStore.dispatchSetFuncArg(),
   * }
   * ```
   */
  public setFuncArgDispatcher() {
    return (uFunc: unknown, uArg: unknown, value: unknown) => {
      this.setFuncArg(
        ensure(uFunc, is.String),
        ensure(uArg, is.String),
        value,
      );
    };
  }

  /**
   * Patch args for a function (or cross all functions).
   * @param {string} func - Target function name or "_" to cross all functions.
   * @param {Record<string, unknown>} args - A record holding arg name and value pairs.
   */
  public patchFuncArgs(func: string | CrossFunc, args: Args) {
    const old = this.#store.get(func) || {};
    this.#store.set(func, { old, ...args });
  }

  /**
   * Make a dispatcher to patch args for a function (or cross all functions).
   * @example
   * ```ts
   * const argStore = new ArgStore();
   * denops.dispatcher = {
   *   customPatchFuncArgs: argStore.dispatchPatchFuncArgs(),
   * }
   * ```
   */
  public patchFuncArgsDispatcher() {
    return (uFunc: unknown, uArgs: unknown) => {
      this.patchFuncArgs(
        ensure(uFunc, is.String),
        ensure(uArgs, isArgs),
      );
    };
  }

  /** Patch args for each functions. */
  public patchArgs(argSet: Record<string | CrossFunc, Args>) {
    for (const func in argSet) {
      const old = this.#store.get(func) || {};
      this.#store.set(func, { old, ...argSet[func] });
    }
  }

  /**
   * Make a dispatcher to patch args for each functions.
   * @example
   * ```ts
   * const argStore = new ArgStore();
   * denops.dispatcher = {
   *   customPatchArgs: argStore.dispatchPatchArgs(),
   * }
   * ```
   */
  public patchArgsDispatcher() {
    return (uArgs: unknown) => {
      this.patchArgs(ensure(uArgs, is.RecordOf(isArgs)));
    };
  }

  private ensureArgs<T>(func: string, pred: Predicate<T>, uArgs: unknown): T {
    return ensure(this.getArgs(func, ensure(uArgs, isArgs)), pred);
  }

  /**
   * Make a dispatcher to dispatch a function with args.
   * @example
   * ```ts
   * const argStore = new ArgStore();
   * const isSomeArgs = is.ObjectOf({
   *   foo: is.String,
   * })
   * denops.dispatcher = {
   *   someFunc: argStore.dispatchFunction(denops, "someFunc", isSomeArgs, (denops, args) => {
   *     // Do something with args
   *   }),
   * }
   */
  public makeDispatcher<T extends Args>(
    denops: Denops,
    functionName: string,
    isArgs: Predicate<T>,
    functionBody: (denops: Denops, args: T) => void | Promise<void>,
  ) {
    return (uArgs: unknown) => {
      return functionBody(denops, this.ensureArgs(functionName, isArgs, uArgs));
    };
  }

  /**
   * Get stored args for a function.
   * @param {string} func - Target function name.
   * @param {Record<string, unknown>} [override] - A record hoding instant arg name and value paris
   */
  public getArgs(func: string, override?: Args): Args {
    const cross = this.#store.get("_") || {};
    const target = this.#store.get(func) || {};
    return {
      ...cross,
      ...target,
      ...override,
    };
  }
}
