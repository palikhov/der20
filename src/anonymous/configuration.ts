import { Der20Token, SelectedTokensCommand } from 'derlib/roll20/token';
import { ConfigurationString } from 'derlib/config/atoms';
import { Result } from 'derlib/config/result';
import { Der20Character } from 'derlib/roll20/character';
import { ParserContext, LoaderContext } from 'derlib/config/context';

var defaultToken: string;

class SetCommand extends SelectedTokensCommand {
    handleToken(token: Der20Token, parserContext: any, tokenIndex: number): Result.Any {
        let character = token.character;
        if (!character.isNpc) {
            return new Result.Success(`'${character.name}' is not an NPC/Monster and won't be changed`);
        }
        let midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        let cacheDefeat = `${midnight.valueOf() / 1000}`;
        let anonymousIcon = `${defaultToken}?${cacheDefeat}`;
        let anonymousName = character.attribute('npc_type').get('current');
        if (anonymousName.length > 0) {
            anonymousName = anonymousName.split(/[,(]/)[0];
        } else {
            anonymousName = '';
        }
        token.raw.set({ imgsrc: anonymousIcon, name: anonymousName, showname: true, showplayers_name: true });
        return new Result.Success(`setting token to ${anonymousIcon}, result: ${token.image.url}`);
    }
}

class RevealCommand extends SelectedTokensCommand {
    handleToken(token: Der20Token, context: ParserContext, tokenIndex: number): Result.Any {
        let character = token.character;
        if (!character.isNpc) {
            return new Result.Success(`'${character.name}' is not an NPC/Monster and won't be changed`);
        }
        // because of request fan-out (selected tokens) we may have many images for which we are waiting
        const imageKey = `RevealCommand_image_${tokenIndex}`;
        let imageSource = context.asyncVariables[imageKey];
        if (imageSource === undefined) {
            return new Result.Asynchronous(`loading default token info from ${character.name}`, imageKey, character.imageLoad());
        }
        token.raw.set({ imgsrc: makeImageSourceURL(imageSource.url), name: character.name, showname: true, showplayers_name: true });
        return new Result.Success(`setting token to show its default name and image from ${character.name}`);
    }
}

function makeImageSourceURL(imageSource: string) {
    if (imageSource.includes('?')) {
        return imageSource;
    }
    let midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let cacheDefeat = `${midnight.valueOf() / 1000}`;
    return `${imageSource}?${cacheDefeat}`;
}

class CharacterConfiguration extends ConfigurationString {
    parse(line: string, context: ParserContext): Result.Any {
        const imageKey = 'CharacterConfiguration_image';
        let imageSource = context.asyncVariables[imageKey];
        if (imageSource !== undefined) {
            defaultToken = imageSource.url;
            return new Result.Change(`loaded anonymous icon from character '${this.value()}'`);
        }
        let result: Result.Any = super.parse(line, context);
        if (!result.isSuccess()) {
            return result;
        }
        let source = Der20Character.byName(this.value());
        if (source === undefined) {
            return new Result.Failure(new Error(`plugin requires a character named '${this.value()}' to provide default token`));
        }
        return new Result.Asynchronous('loading default token', imageKey, source.imageLoad());
    }

    load(json: any, context: LoaderContext) {
        super.load(json, context);
        let source = Der20Character.byName(this.value());
        if (source === undefined) {
            context.addMessage(`plugin requires a character named '${this.value()}' to provide default token`);
            return;
        }
        context.addAsynchronousLoad(source.imageLoad(), (value) => {
            defaultToken = value.url;
        });
    }
}


export class Configuration {
    // name of a character in the journal that will provide its default token image for anonymous tokens
    character: CharacterConfiguration = new CharacterConfiguration('Anonymous');

    // set the selected tokens as anonymous
    set: SetCommand = new SetCommand();

    // reveal the selected tokens' real identites
    reveal: RevealCommand = new RevealCommand();
}
