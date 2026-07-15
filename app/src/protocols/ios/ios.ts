import { ProtocolAdapter } from '../protocol';
import { Target } from '../target';
import { debug, Logger } from '../../logger';
import { ScreencastSession } from './screencast';

export class IOSProtocol extends ProtocolAdapter {
  static BEGIN_COMMENT = '/* ';
  static END_COMMENT = ' */';
  static SEPARATOR = ': ';

  protected _styleMap: Map<string, any>;
  private _lastNodeId: number;
  private _lastPageExecutionContextId: number;
  private _lastScriptEval: string;
  private _screencastSession: ScreencastSession;

  constructor(target: Target) {
    super(target);
    this._styleMap = new Map();
    this.setupFilters();
  }

  private setupFilters(): void {
    this._target.on('tools::DOM.getDocument', () => this.onDomGetDocument());


    this._target.addMessageFilter('tools::CSS.setStyleTexts', (msg) => this.onSetStyleTexts(msg));
    this._target.addMessageFilter('tools::CSS.getMatchedStylesForNode', (msg) => this.onGetMatchedStylesForNode(msg));
    this._target.addMessageFilter('tools::CSS.getBackgroundColors', (msg) => this.onGetBackgroundColors(msg));
    this._target.addMessageFilter('tools::CSS.addRule', (msg) => this.onAddRule(msg));
    this._target.addMessageFilter('tools::CSS.getPlatformFontsForNode', (msg) => this.onGetPlatformFontsForNode(msg));
    this._target.addMessageFilter('target::CSS.getMatchedStylesForNode', (msg) => this.onGetMatchedStylesForNodeResult(msg));
    this._target.addMessageFilter('tools::Page.startScreencast', (msg) => this.onStartScreencast(msg));
    this._target.addMessageFilter('tools::Page.stopScreencast', (msg) => this.onStopScreencast(msg));
    this._target.addMessageFilter('tools::Page.screencastFrameAck', (msg) => this.onScreencastFrameAck(msg));
    this._target.addMessageFilter('tools::Page.getNavigationHistory', (msg) => this.onGetNavigationHistory(msg));
    this._target.addMessageFilter('tools::Page.setOverlayMessage', (msg) => { msg.method = 'Debugger.setOverlayMessage'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Page.configureOverlay', (msg) => { msg.method = 'Debugger.setOverlayMessage'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::DOM.enable', (msg) => this.onDomEnable(msg));
    this._target.addMessageFilter('tools::DOM.setInspectMode', (msg) => this.onSetInspectMode(msg));
    this._target.addMessageFilter('tools::DOM.setInspectedNode', (msg) => { msg.method = 'Console.addInspectedNode'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::DOM.pushNodesByBackendIdsToFrontend', (msg) => this.onPushNodesByBackendIdsToFrontend(msg));
    this._target.addMessageFilter('tools::DOM.getBoxModel', (msg) => this.onGetBoxModel(msg));
    this._target.addMessageFilter('tools::DOM.getNodeForLocation', (msg) => this.onGetNodeForLocation(msg));


    this._target.addMessageFilter('tools::DOMDebugger.getEventListeners', (msg) => this.onGetEventListeners(msg));
    this._target.addMessageFilter('tools::Debugger.canSetScriptSource', (msg) => this.onCanSetScriptSource(msg));
    this._target.addMessageFilter('tools::Debugger.setBlackboxPatterns', (msg) => this.onSetBlackboxPatterns(msg));
    this._target.addMessageFilter('tools::Debugger.setAsyncCallStackDepth', (msg) => this.onSetAsyncCallStackDepth(msg));
    this._target.addMessageFilter('tools::Debugger.enable', (msg) => this.onDebuggerEnable(msg));
    this._target.addMessageFilter('target::Debugger.scriptParsed', (msg) => this.onScriptParsed(msg));
    this._target.addMessageFilter('tools::Emulation.canEmulate', (msg) => this.onCanEmulate(msg));
    this._target.addMessageFilter('tools::Emulation.setTouchEmulationEnabled', (msg) => { msg.method = 'Page.setTouchEmulationEnabled'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Emulation.setScriptExecutionDisabled', (msg) => { msg.method = 'Page.setScriptExecutionDisabled'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Emulation.setEmulatedMedia', (msg) => { msg.method = 'Page.setEmulatedMedia'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Rendering.setShowPaintRects', (msg) => { msg.method = 'Page.setShowPaintRects'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Input.emulateTouchFromMouseEvent', (msg) => this.onEmulateTouchFromMouseEvent(msg));
    this._target.addMessageFilter('tools::Log.clear', (msg) => { msg.method = 'Console.clearMessages'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Log.disable', (msg) => { msg.method = 'Console.disable'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Log.enable', (msg) => { msg.method = 'Console.enable'; return Promise.resolve(msg); });
    this._target.addMessageFilter('target::Console.messageAdded', (msg) => this.onConsoleMessageAdded(msg));
    this._target.addMessageFilter('tools::Network.getCookies', (msg) => { msg.method = 'Page.getCookies'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Network.deleteCookie', (msg) => { msg.method = 'Page.deleteCookie'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Network.setMonitoringXHREnabled', (msg) => { msg.method = 'Console.setMonitoringXHREnabled'; return Promise.resolve(msg); });
    this._target.addMessageFilter('tools::Network.canEmulateNetworkConditions', (msg) => this.onCanEmulateNetworkConditions(msg));
    this._target.addMessageFilter('tools::Runtime.compileScript', (msg) => this.onRuntimeCompileScript(msg));
    this._target.addMessageFilter('target::Runtime.executionContextCreated', (msg) => this.onExecutionContextCreated(msg));
    this._target.addMessageFilter('target::Runtime.evaluate', (msg) => this.onEvaluate(msg));
    this._target.addMessageFilter('target::Runtime.getProperties', (msg) => this.onRuntimeGetProperties(msg));
    this._target.addMessageFilter('target::Inspector.inspect', (msg) => this.onInspect(msg));
  }


  private onDomGetDocument(): void {
    this.enumerateStyleSheets();
  }

  private onSetStyleTexts(msg: any): Promise<any> {
    const resultId = msg.id;
    const promises: Promise<any>[] = [];
    for (let i = 0; i < msg.params.edits.length; i++) {
      const edit = msg.params.edits[i];
      const paramsGetStyleSheet = { styleSheetId: edit.styleSheetId };
      const setStyleText = this._target.callTarget('CSS.getStyleSheet', paramsGetStyleSheet).then((result: any) => {
        if (!result.styleSheet || !result.styleSheet.rules) {
          Logger.error('iOS returned a value we were not expecting for getStyleSheet');
          return Promise.resolve(null);
        }
        const length = result.styleSheet.rules.length;
        for (let ordinal = 0; ordinal < length; ordinal++) {
          const rule = result.styleSheet.rules[ordinal];
          if (this.compareRanges(rule.style.range, edit.range)) {
            const params = { styleId: { styleSheetId: edit.styleSheetId, ordinal }, text: edit.text };
            return this._target.callTarget('CSS.setStyleText', params).then((setStyleResult: any) => {
              this.mapStyle(setStyleResult.style, '');
              return setStyleResult.style;
            });
          }
        }
      });
      promises.push(setStyleText);
    }
    Promise.all(promises).then((allResults) => {
      this._target.fireResultToTools(resultId, { styles: allResults });
    });
    return Promise.resolve(null);
  }

  private compareRanges(rangeLeft: any, rangeRight: any): boolean {
    return rangeLeft.startLine === rangeRight.startLine &&
      rangeLeft.endLine === rangeRight.endLine &&
      rangeLeft.startColumn === rangeRight.startColumn &&
      rangeLeft.endColumn === rangeRight.endColumn;
  }

  private onGetMatchedStylesForNode(msg: any): Promise<any> {
    this._lastNodeId = msg.params.nodeId;
    return Promise.resolve(msg);
  }

  private onCanEmulate(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, { result: true });
    return Promise.resolve(null);
  }

  private onGetPlatformFontsForNode(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, { fonts: [] });
    return Promise.resolve(null);
  }

  private onGetBackgroundColors(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, { backgroundColors: [] });
    return Promise.resolve(null);
  }


  private onAddRule(msg: any): Promise<any> {
    const selector = msg.params.ruleText.trim().replace('{}', '');
    const params = { contextNodeId: this._lastNodeId, selector };
    this._target.callTarget('CSS.addRule', params).then((result: any) => {
      this.mapRule(result.rule);
      this._target.fireResultToTools(msg.id, result);
    });
    return Promise.resolve(null);
  }

  private onCanSetScriptSource(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, { result: false });
    return Promise.resolve(null);
  }

  private onSetBlackboxPatterns(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, {});
    return Promise.resolve(null);
  }

  private onSetAsyncCallStackDepth(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, { result: true });
    return Promise.resolve(null);
  }

  private onDebuggerEnable(msg: any): Promise<any> {
    this._target.callTarget('Debugger.setBreakpointsActive', { active: true });
    return Promise.resolve(msg);
  }

  private onGetMatchedStylesForNodeResult(msg: any): Promise<any> {
    const result = msg.result;
    if (result) {
      for (const i in result.matchedCSSRules) {
        if (result.matchedCSSRules[i].rule) {
          this.mapRule(result.matchedCSSRules[i].rule);
        }
      }
      for (const i in result.inherited) {
        if (result.inherited[i].matchedCSSRules) {
          for (const j in result.inherited[i].matchedCSSRules) {
            if (result.inherited[i].matchedCSSRules[j].rule) {
              this.mapRule(result.inherited[i].matchedCSSRules[j].rule);
            }
          }
        }
      }
    }
    return Promise.resolve(msg);
  }

  private onExecutionContextCreated(msg: any): Promise<any> {
    if (msg.params && msg.params.context) {
      if (!msg.params.context.origin) {
        msg.params.context.origin = msg.params.context.name;
      }
      if (msg.params.context.isPageContext) {
        this._lastPageExecutionContextId = msg.params.context.id;
      }
      if (msg.params.context.frameId) {
        msg.params.context.auxData = { frameId: msg.params.context.frameId, isDefault: true };
        delete msg.params.context.frameId;
      }
    }
    return Promise.resolve(msg);
  }


  private onEvaluate(msg: any): Promise<any> {
    if (msg.result && msg.result.wasThrown) {
      msg.result.result.subtype = 'error';
      msg.result.exceptionDetails = {
        text: msg.result.result.description, url: '', scriptId: this._lastScriptEval, line: 1, column: 0,
        stack: { callFrames: [{ functionName: '', scriptId: this._lastScriptEval, url: '', lineNumber: 1, columnNumber: 1 }] }
      };
    } else if (msg.result && msg.result.result && msg.result.result.preview) {
      msg.result.result.preview.description = msg.result.result.description;
      msg.result.result.preview.type = 'object';
    }
    return Promise.resolve(msg);
  }

  private onRuntimeCompileScript(msg: any): Promise<any> {
    const params = { expression: msg.params.expression, contextId: msg.params.executionContextId };
    this._target.callTarget('Runtime.evaluate', params).then(() => {
      this._target.fireResultToTools(msg.id, { scriptId: null, exceptionDetails: null });
    });
    return Promise.resolve(null);
  }

  private onRuntimeGetProperties(msg: any): Promise<any> {
    const newPropertyDescriptors: any[] = [];
    for (let i = 0; i < msg.result.result.length; i++) {
      if (msg.result.result[i].isOwn || msg.result.result[i].nativeGetter) {
        msg.result.result[i].isOwn = true;
        newPropertyDescriptors.push(msg.result.result[i]);
      }
    }
    msg.result.result = newPropertyDescriptors;
    return Promise.resolve(msg);
  }

  private onScriptParsed(msg: any): Promise<any> {
    this._lastScriptEval = msg.params.scriptId;
    return Promise.resolve(msg);
  }

  private onDomEnable(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, {});
    return Promise.resolve(null);
  }

  private onSetInspectMode(msg: any): Promise<any> {
    msg.method = 'DOM.setInspectModeEnabled';
    msg.params.enabled = (msg.params.mode === 'searchForNode');
    delete msg.params.mode;
    return Promise.resolve(msg);
  }

  private onInspect(msg: any): Promise<any> {
    msg.method = 'DOM.inspectNodeRequested';
    msg.params.backendNodeId = msg.params.object.objectId;
    delete msg.params.object;
    delete msg.params.hints;
    return Promise.resolve(msg);
  }


  private onGetEventListeners(msg: any): Promise<any> {
    const requestNodeParams = { objectId: msg.params.objectId };
    this._target.callTarget('DOM.requestNode', requestNodeParams).then((result: any) => {
      const params = { nodeId: result.nodeId, objectGroup: 'event-listeners-panel' };
      return this._target.callTarget('DOM.getEventListenersForNode', params);
    }).then((result: any) => {
      const mappedListeners = result.listeners.map((listener: any) => ({
        type: listener.type, useCapture: listener.useCapture, passive: false,
        location: listener.location, handler: listener.handler
      }));
      this._target.fireResultToTools(msg.id, { listeners: mappedListeners });
    });
    return Promise.resolve(null);
  }

  private onPushNodesByBackendIdsToFrontend(msg: any): Promise<any> {
    const resultId = msg.id;
    const promises: Promise<number>[] = [];
    for (let i = 0; i < msg.params.backendNodeIds.length; i++) {
      const params = { backendNodeId: msg.params.backendNodeIds[i] };
      const pushNode = this._target.callTarget('DOM.pushNodeByBackendIdToFrontend', params).then((result: any) => result.nodeId);
      promises.push(pushNode);
    }
    Promise.all(promises).then((allResults) => {
      this._target.fireResultToTools(resultId, { nodeIds: allResults });
    });
    return Promise.resolve(null);
  }

  private onGetBoxModel(msg: any): Promise<any> {
    const params = {
      highlightConfig: {
        showInfo: true, showRulers: false, showExtensionLines: false,
        contentColor: { r: 111, g: 168, b: 220, a: 0.66 },
        paddingColor: { r: 147, g: 196, b: 125, a: 0.55 },
        borderColor: { r: 255, g: 229, b: 153, a: 0.66 },
        marginColor: { r: 246, g: 178, b: 107, a: 0.66 },
        eventTargetColor: { r: 255, g: 196, b: 196, a: 0.66 },
        shapeColor: { r: 96, g: 82, b: 177, a: 0.8 },
        shapeMarginColor: { r: 96, g: 82, b: 127, a: 0.6 },
        displayAsMaterial: true
      },
      nodeId: msg.params.nodeId
    };
    this._target.callTarget('DOM.highlightNode', params);
    return Promise.resolve(null);
  }

  private onGetNodeForLocation(msg: any): Promise<any> {
    this._target.callTarget('Runtime.evaluate', { expression: `document.elementFromPoint(${msg.params.x},${msg.params.y})` }).then((obj: any) => {
      this._target.callTarget('DOM.requestNode', { objectId: obj.result.objectId }).then((result: any) => {
        this._target.fireResultToTools(msg.id, { nodeId: result.nodeId });
      });
    });
    return Promise.resolve(null);
  }


  private onStartScreencast(msg: any): Promise<any> {
    if (this._screencastSession) {
      this._screencastSession.dispose();
    }
    this._screencastSession = new ScreencastSession(this._target, msg.params.format, msg.params.quality, msg.params.maxWidth, msg.params.maxHeight);
    this._screencastSession.start();
    this._target.fireResultToTools(msg.id, {});
    return Promise.resolve(null);
  }

  private onStopScreencast(msg: any): Promise<any> {
    if (this._screencastSession) {
      this._screencastSession.stop();
      this._screencastSession = null;
    }
    this._target.fireResultToTools(msg.id, {});
    return Promise.resolve(null);
  }

  private onScreencastFrameAck(msg: any): Promise<any> {
    if (this._screencastSession) {
      this._screencastSession.ackFrame(msg.params.sessionId);
    }
    this._target.fireResultToTools(msg.id, {});
    return Promise.resolve(null);
  }

  private onGetNavigationHistory(msg: any): Promise<any> {
    let href = '';
    this._target.callTarget('Runtime.evaluate', { expression: 'window.location.href' }).then((result: any) => {
      href = result.result.value;
      return this._target.callTarget('Runtime.evaluate', { expression: 'window.title' });
    }).then((result: any) => {
      const title = result.result.value;
      this._target.fireResultToTools(msg.id, { currentIndex: 0, entries: [{ id: 0, url: href, title }] });
    });
    return Promise.resolve(null);
  }

  private onEmulateTouchFromMouseEvent(msg: any): Promise<any> {
    switch (msg.params.type) {
      case 'mousePressed': msg.params.type = 'mousedown'; break;
      case 'mouseReleased': msg.params.type = 'click'; break;
      case 'mouseMoved': msg.params.type = 'mousemove'; break;
      default: Logger.error(`Unknown emulate mouse event name '${msg.params.type}'`); break;
    }
    const exp = `(function(params){var el=document.elementFromPoint(params.x,params.y);var e=new MouseEvent(params.type,{screenX:params.x,screenY:params.y,clientX:0,clientY:0,button:params.button,bubbles:true,cancelable:false});el.dispatchEvent(e);return el;})(${JSON.stringify(msg.params)})`;
    this._target.callTarget('Runtime.evaluate', { expression: exp }).then(() => {
      if (msg.params.type === 'click') {
        msg.params.type = 'mouseup';
        this._target.callTarget('Runtime.evaluate', { expression: exp });
      }
    });
    return this._target.replyWithEmpty(msg);
  }

  private onCanEmulateNetworkConditions(msg: any): Promise<any> {
    this._target.fireResultToTools(msg.id, { result: false });
    return Promise.resolve(null);
  }


  private onConsoleMessageAdded(msg: any): Promise<any> {
    const message = msg.params.message;
    let type: string;
    if (message.type === 'log') {
      switch (message.level) {
        case 'log': type = 'log'; break;
        case 'info': type = 'info'; break;
        case 'error': type = 'error'; break;
        default: type = 'log';
      }
    } else {
      type = message.type;
    }
    const consoleMessage = {
      source: message.source, level: type, text: message.text, lineNumber: message.line,
      timestamp: Date.now(), url: message.url,
      stackTrace: message.stackTrace ? { callFrames: message.stackTrace } : undefined,
      networkRequestId: message.networkRequestId
    };
    this._target.fireEventToTools('Log.entryAdded', { entry: consoleMessage });
    return Promise.resolve(null);
  }

  private enumerateStyleSheets(): void {
    this._target.callTarget('CSS.getAllStyleSheets', {}).then((msg: any) => {
      if (msg.headers) {
        for (const header of msg.headers) {
          header.isInline = false;
          header.startLine = 0;
          header.startColumn = 0;
          this._target.fireEventToTools('CSS.styleSheetAdded', { header });
        }
      }
    });
  }

  protected mapSelectorList(selectorList: any): void {
    // Each iOS version overrides this
  }

  private mapRule(cssRule: any): void {
    if ('ruleId' in cssRule) {
      cssRule.styleSheetId = cssRule.ruleId.styleSheetId;
      delete cssRule.ruleId;
    }
    this.mapSelectorList(cssRule.selectorList);
    this.mapStyle(cssRule.style, cssRule.origin);
    delete cssRule.sourceLine;
  }

  private mapStyle(cssStyle: any, ruleOrigin: string): void {
    if (cssStyle.cssText) {
      const disabled = IOSProtocol.extractDisabledStyles(cssStyle.cssText, cssStyle.range);
      for (let i = 0; i < disabled.length; i++) {
        const text = disabled[i].content.trim().replace(/^\/\*\s*/, '').replace(/;\s*\*\/$/, '');
        const parts = text.split(':');
        if (cssStyle.cssProperties) {
          let index = cssStyle.cssProperties.length;
          for (let j = 0; j < cssStyle.cssProperties.length; j++) {
            if (cssStyle.cssProperties[j].range &&
              (cssStyle.cssProperties[j].range.startLine > disabled[i].range.startLine ||
                (cssStyle.cssProperties[j].range.startLine === disabled[i].range.startLine &&
                  cssStyle.cssProperties[j].range.startColumn > disabled[i].range.startColumn))) {
              index = j;
              break;
            }
          }
          cssStyle.cssProperties.splice(index, 0, {
            implicit: false, name: parts[0], range: disabled[i].range,
            status: 'disabled', text: disabled[i].content, value: parts[1]
          });
        }
      }
    }
    for (const cssProperty of cssStyle.cssProperties) {
      this.mapCssProperty(cssProperty);
    }
    if (ruleOrigin !== 'user-agent') {
      cssStyle.styleSheetId = cssStyle.styleId.styleSheetId;
      const styleKey = `${cssStyle.styleSheetId}_${JSON.stringify(cssStyle.range)}`;
      this._styleMap.set(styleKey, cssStyle.styleId);
    }
    delete cssStyle.styleId;
    delete cssStyle.sourceLine;
    delete cssStyle.sourceURL;
    delete cssStyle.width;
    delete cssStyle.height;
  }


  private mapCssProperty(cssProperty: any): void {
    if (cssProperty.status === 'disabled') {
      cssProperty.disabled = true;
    } else if (cssProperty.status === 'active') {
      cssProperty.disabled = false;
    }
    delete cssProperty.status;
    cssProperty.important = !!cssProperty.priority;
    delete cssProperty.priority;
  }

  static getLineColumnFromIndex(text: string, index: number, startRange?: any): { line: number; column: number } | null {
    if (text === null || typeof text === 'undefined' || index < 0 || index > text.length) {
      return null;
    }
    let line = startRange ? startRange.startLine : 0;
    let column = startRange ? startRange.startColumn : 0;
    for (let i = 0; i < text.length && i < index; i++) {
      if (text[i] === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++;
        line++;
        column = 0;
      } else if (text[i] === '\n' || text[i] === '\r') {
        line++;
        column = 0;
      } else {
        column++;
      }
    }
    return { line, column };
  }

  static extractDisabledStyles(styleText: string, range: any): any[] {
    const startIndices: number[] = [];
    const styles: any[] = [];
    for (let index = 0; index < styleText.length; index++) {
      if (styleText.substr(index, IOSProtocol.BEGIN_COMMENT.length) === IOSProtocol.BEGIN_COMMENT) {
        startIndices.push(index);
        index = index + IOSProtocol.BEGIN_COMMENT.length - 1;
      } else if (styleText.substr(index, IOSProtocol.END_COMMENT.length) === IOSProtocol.END_COMMENT) {
        if (startIndices.length === 0) return [];
        const startIndex = startIndices.pop();
        const endIndex = index + IOSProtocol.END_COMMENT.length;
        const startRange = IOSProtocol.getLineColumnFromIndex(styleText, startIndex, range);
        const endRange = IOSProtocol.getLineColumnFromIndex(styleText, endIndex, range);
        styles.push({
          content: styleText.substring(startIndex, endIndex),
          range: { startLine: startRange.line, startColumn: startRange.column, endLine: endRange.line, endColumn: endRange.column }
        });
        index = endIndex - 1;
      }
    }
    if (startIndices.length !== 0) return [];
    return styles;
  }
}
