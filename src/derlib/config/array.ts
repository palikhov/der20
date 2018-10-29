import { ConfigurationStep, CollectionItem } from './atoms';
import { ConfigurationParser } from './parser';
import { DefaultConstructed, cloneExcept } from 'derlib/utility';
import { Result } from './result';
import { DialogFactory } from 'derlib/ui';
import { ConfigurationLoader } from './loader';
import { ParserContext, LoaderContext } from './context';

export class ConfigurationArray<T extends CollectionItem> extends ConfigurationStep<T[]> {
    current: T[] = [];
    ids: { [index: string]: number } = {};

    classType: DefaultConstructed<T>;

    constructor(singularName: string, itemClass: DefaultConstructed<T>) {
        super([]);
        this.classType = itemClass;
        this.keyword = singularName;
    }

    toJSON(): any {
        return this.current;
    }

    clear() {
        this.current = [];
        this.ids = {};
    }

    load(json: any, context: LoaderContext) {
        this.clear();
        if (!Array.isArray(json)) {
            // ignore, might be schema change we can survive
            context.addMessage('ignoring non-array JSON in saved state; configuration array reset');
            return;
        }
        // tslint:disable-next-line:forin
        for (let key in json) {
            let item = new this.classType();
            let child: any = json[key];
            ConfigurationLoader.restore(child, item, context);
            this.ids[item.id] = this.current.length;
            this.current.push(item);
        }
    }

    parse(line: string, context: ParserContext): Result.Any {
        let tokens = ConfigurationParser.tokenizeFirst(line);
        let id: string = tokens[0];
        if (id.length < 1) {
            return new Result.Failure(new Error('interactive selection from array is unimplemented'));
        }
        let index: number;
        if (this.ids.hasOwnProperty(id)) {
            index = this.ids[id];
            return ConfigurationParser.parse(tokens[1], this.current[index], context);
        } else {
            index = this.addItem(id, new this.classType());
            let result = ConfigurationParser.parse(tokens[1], this.current[index], context);
            result.messages.unshift(`created item ${id}`);
            return result;
        }
    }

    addItem(id: string, item: T) {
        let index = this.current.length;
        item.id = id;
        this.current.push(item);
        this.ids[id] = index;
        return index;
    }

    removeItem(id: string): boolean {
        let index = this.ids[id];
        if (index === undefined) {
            return false;
        }
        delete this.ids[id];
        this.current.splice(index, 1);
        return true;
    }

    clone(): ConfigurationArray<T> {
        let copied = new ConfigurationArray<T>(this.keyword, this.classType);
        for (let index = 0; index < this.current.length; index++) {
            copied.addItem(this.current[index].id, cloneExcept(this.classType, this.current[index], ['id']));
        }
        return copied;
    }

    collectionItem(): T {
        return new this.classType();
    }
}

export class ConfigurationChooser<T extends CollectionItem> extends ConfigurationStep<T> {
    // this id can be used to refer to the most recently selected item
    static readonly MAGIC_CURRENT_ID: string = 'current';

    current: T = ConfigurationStep.NO_VALUE;
    array: ConfigurationArray<T>;
    selectedId: string;
    path: string;
    dialogFactory: DialogFactory;

    constructor(array: ConfigurationArray<T>, dialogFactory: DialogFactory, path: string) {
        super(ConfigurationStep.NO_VALUE);
        this.array = array;
        this.dialogFactory = dialogFactory;
        this.path = path;
    }

    toJSON(): any {
        // shallow copy so we can overwrite id (must not be changed)
        let result: any = {};
        if (this.hasConfiguredValue()) {
            let source: any = this.current;
            if (typeof source.toJSON === 'function') {
                source = source.toJSON();
            }
            Object.assign(result, source);
        }
        result.id = this.selectedId;
        return result;
    }

    load(json: any, context: LoaderContext): Result.Any {
        this.selectedId = json.id;
        // now we wait until this object is used, because the array may not have loaded yet
        // NOTE: any per-session overrides are now lost
        return new Result.Change('restored selection from array');
    }

    collectionItem(): T {
        return new this.array.classType();
    }

    private createChooserDialog(rest: string): Result.Dialog {
        // we don't know what command word was used to call us, so we let the caller fix it up
        let dialog = new this.dialogFactory(`${ConfigurationParser.MAGIC_COMMAND_STRING} `);
        dialog.addTitle(`Selection for '${this.path}'`);
        dialog.addSeparator();
        dialog.addSubTitle('Please choose an item:');
        dialog.addChoiceControlGroup(this.array.keyword, this.path, this.array.current, rest);
        return new Result.Dialog(Result.Dialog.Destination.Caller, dialog.render());
    }

    private handleCurrent(rest: string, context: ParserContext): Result.Any {
        if (this.selectedId !== undefined) {
            if (this.current === ConfigurationStep.NO_VALUE) {
                // right after restoring from JSON, the item data has not been loaded yet
                return this.loadItem(this.selectedId, rest, context);
            }
            return ConfigurationParser.parse(rest, this.current, context);
        }
        if (this.array.current.length > 1) {
            // present interactive chooser
            return this.createChooserDialog(rest);
        }
        if (this.array.current.length === 1) {
            // auto select only defined item, if any
            let id = this.array.current[0].id;
            let result = this.loadItem(id, rest, context);
            result.messages.unshift(`${this.array.keyword} ${id} was automatically selected, because it is the only one defined`);
            return result;
        }
        // remaining case is no items in collection
        return new Result.Failure(new Error(`${this.array.keyword} could not be selected, because none are defined`));
    }

    parse(line: string, context: ParserContext): Result.Any {
        let tokens = ConfigurationParser.tokenizeFirst(line);
        let id = tokens[0];

        if (id === ConfigurationChooser.MAGIC_CURRENT_ID) {
            return this.handleCurrent(tokens[1], context);
        }

        if (id.length < 1) {
            // treat this the same as current, to auto load if applicable
            return this.handleCurrent(tokens[1], context);
        }

        if (!this.array.ids.hasOwnProperty(id)) {
            this.clear();
            return new Result.Failure(new Error(`item "${id}" is not defined`));
        }

        return this.loadItem(id, tokens[1], context);
    }

    private loadItem(id: string, rest: string, context: ParserContext): Result.Any {
        let index = this.array.ids[id];
        this.current = cloneExcept(this.array.classType, this.array.current[index], ['id']);
        this.selectedId = id;
        if (rest.length < 1) {
            return new Result.Change(`selected item ${this.current.name.value() || id}`);
        }
        return ConfigurationParser.parse(rest, this.current, context);
    }

    clear() {
        this.selectedId = undefined;
        this.current = ConfigurationStep.NO_VALUE;
    }
}
