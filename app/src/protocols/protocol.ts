import { Target } from './target';

export class ProtocolAdapter {
  protected _target: Target;

  constructor(target: Target) {
    this._target = target;
  }
}
