import { ConfigurationStep } from './atoms'
import { Result } from './result';
import { ParserContext } from './context';

export class ConfigurationParser {
    // this string can be substituted for the command path by the caller
    static readonly MAGIC_COMMAND_STRING: string = 'DER20_MAGIC_COMMAND_STRING';

    // returns first word and rest of line as array
    static tokenizeFirst(line: string) {
        let clean = line.trim();
        let space = clean.indexOf(' ');
        if (space < 0) {
            return [clean, ''];
        }
        return [clean.substr(0, space), clean.substr(space + 1)];
    }

    static parse(line: string, configuration: any, context: ParserContext): Result.Any {
        debug.log(`parsing "${line}" against ${typeof configuration} ${JSON.stringify(configuration)}`);
        if (configuration instanceof ConfigurationStep) {
            return configuration.parse(line, context);
        }
        let tokens = ConfigurationParser.tokenizeFirst(line);
        if (configuration.hasOwnProperty(tokens[0])) {
            let target = configuration[tokens[0]];
            if (target == null) {
                throw new Error(`property '${tokens[0]}' should be an empty configuration object instead of null`);
            }
            let result = ConfigurationParser.parse(tokens[1], target, context);
            if (!(result.hasEvents)) {
                return result;
            }
            if (configuration instanceof ConfigurationEventHandler) {
                result = configuration.handleEvents(tokens[0], context, result);
            }
            return result;
        }
        // search for property that has special key word
        for (let key in configuration) {
            if (!configuration.hasOwnProperty(key)) {
                continue;
            }
            let item = configuration[key];
            // XXX for some reason instanceof ConfigurationStep returns false for ConfigurationArray<...>
            if ((item != null) && item.hasOwnProperty('keyword')) {
                if (item.keyword === tokens[0]) {
                    return item.parse(tokens[1]);
                }
            }
        }
        if (tokens[0].length > 0) {
            return new Result.Failure(new Error(`token '${tokens[0]}' did not match any configuration command`));
        }
        // empty token was claimed by no item, that is ok
        return new Result.Success('no configuration changed');
    }
}

export class ConfigurationEventHandler {
    private handlers: ConfigurationEventHandler.SourceMap = new ConfigurationEventHandler.SourceMap();

    addTrigger(source: string, event: Result.Event, update: ConfigurationUpdate.Base): void {
        let eventMap = this.handlers.get(source);
        eventMap.events[event].push(update);
    }

    handleEvents(source: string, context: ParserContext, result: Result.Any): Result.Any {
        let listeners: ConfigurationEventHandler.EventMap = this.handlers.fetch(source);
        if (listeners === undefined) {
            return result;
        }
        // iterate event types posted on configuration result
        for (let event of result.events) {
            // process all handlers[event] until one changes the result to a failure
            for (let handler of listeners.events[event]) {
                let handlerResult = handler.execute(this, context, result);
                if (handlerResult.kind === Result.Kind.Failure) {
                    return handlerResult;
                }
            }
        }
        return result;
    }
}

export namespace ConfigurationEventHandler {
    export class SourceMap {
        private sources: Record<string, ConfigurationEventHandler.EventMap> = {};

        clone() {
            // share across all clones
            return this;
        }

        toJSON(): any {
            return undefined;
        }

        get(source: string): ConfigurationEventHandler.EventMap {
            let item = this.sources[source];
            if (item === undefined) {
                item = new ConfigurationEventHandler.EventMap();
                this.sources[source] = item;
            }
            return item;
        }

        fetch(source: string) {
            return this.sources[source];
        }
    }

    export class EventMap {
        events: Record<Result.Event, ConfigurationUpdate.Base[]> = { change: [] };
    }
}

export namespace ConfigurationUpdate {  
    // WARNING: descendants of this class must not maintain direct references to config objects because 
    // these items are shared by all clones of the config subtree
    export abstract class Base {
        abstract execute(configuration: any, context: ParserContext, result: Result.Any): Result.Any;
    }  

    export class Default<SOURCE, TARGET> extends Base {
        constructor(private path: string[], private calculator: () => TARGET) {
            super();
        }

        execute(configuration: SOURCE, context: ParserContext, result: Result.Any): Result.Any {
            let value = this.calculator.apply(configuration);
            // XXX can this be made type safe?
            let walk: any = configuration;
            for (let segment of this.path) {
                walk = walk[segment];
            }
            // tslint:disable-next-line:no-string-literal
            walk['default'] = value;
            return result;
        }
    }
}