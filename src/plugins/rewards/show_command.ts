import { ConfigurationSimpleCommand, ConfigurationFromTemplate, } from 'der20/library';
import { Result, Success, DialogResult } from 'der20/library';
import { ConfigurationChooser } from 'der20/library';
import { ParserContext } from 'der20/library';
import { DungeonMaster } from './ddal/dungeon_master';
import { LeagueModule, LeagueModuleDefinition } from './ddal/league_module';

export abstract class RenderCommand extends ConfigurationSimpleCommand {
    constructor(protected dm: ConfigurationChooser<DungeonMaster>, protected module: ConfigurationFromTemplate<LeagueModuleDefinition, LeagueModule>) {
        super();
        // generated code
    }

    protected tryLoad(context: ParserContext): Result {
        let result: Result = new Success('no configuration changed');
        if (this.dm.current == null) {
            result = this.dm.handleCurrent('', context, [context.rest]);
            if (!result.isSuccess()) {
                return result;
            }
        }
        if (this.module.current == null) {
            result = this.module.handleCurrent('', context, [context.rest]);
            if (!result.isSuccess()) {
                return result;
            }
        }
        return result;
    }
}

export class ShowCommand extends RenderCommand {
    toJSON(): any {
        return undefined;
    }

    handleEndOfCommand(context: ParserContext): Result {
        // load if possible
        let result = this.tryLoad(context);
        if (!result.isSuccess()) {
            return result;
        }
        let dialog = new context.dialog();
        const link = { 
            command: context.command, 
            followUps: [ context.rest ]
        };
        dialog.addTitle('Log Entry for Current Session');
        dialog.addSeparator();
        dialog.addSubTitle('DM');
        dialog.beginControlGroup();
        dialog.addEditControl('Name', 'dm current name', this.dm.current.name, link);
        dialog.addEditControl('DCI', 'dm current dci', this.dm.current.dci, link);
        dialog.endControlGroup();
        dialog.addSeparator();
        dialog.addSubTitle('Module');
        dialog.beginControlGroup();
        let module = this.module.current;
        dialog.addEditControl('Module Name', 'module current name', module.name, link);
        dialog.addEditControl('Season', 'module current season', module.season, link);
        dialog.addEditControl('Hard Cover', 'module current hardcover', module.hardcover, link);
        dialog.addEditControl('Tier', 'module current tier', module.tier, link);
        dialog.addEditControl('Minimum Level', 'module current level minimum', module.level.minimum, link);
        dialog.addEditControl('Maximum Level', 'module current level maximum', module.level.maximum, link);
        dialog.addEditControl('Advancement/hr', 'module current hourly advancement', module.hourly.advancement, link);
        dialog.addEditControl('Treasure/hr', 'module current hourly treasure', module.hourly.treasure, link);
        dialog.addEditControl('Maximum Duration', 'module current duration', module.duration, link);
        dialog.addEditControl('Start Time', 'module current start', module.start, link);
        dialog.addEditControl('End Time', 'module current stop', module.stop, link);
        dialog.endControlGroup();
        dialog.addSeparator();
        dialog.addSubTitle('Check Points and Unlocks');
        dialog.beginControlGroup();
        for (let check of module.checkpoints.current) {
            const label = `${check.name.value()} (${check.advancement.value()} ACP, ${check.treasure.value()} TCP)`;
            dialog.addEditControl(label, `module current checkpoint ${check.id} awarded`, check.awarded, link);
        }
        for (let item of module.unlocks.current) {
            const label = `Unlocked ${item.name.value()}`;
            dialog.addEditControl(label, `module current unlock ${item.id} awarded`, item.awarded, link);
        }
        dialog.endControlGroup();
        dialog.addSeparator();

        // select from all player controlled creatures for automatic APL and to include/exclude in rewards
        dialog.addSubTitle('Players');
        dialog.beginControlGroup();
        for (let pc of module.pcs.characters) {
            let levelString = '';
            let level = pc.character.attribute('level').value(0);
            if (level > 0) {
                levelString = ` (level ${level})`;
            }
            dialog.addEditControl(
                `${pc.player.name}: ${pc.character.name}${levelString}`,
                `module current pc ${pc.player.userid} character ${pc.character.id} selected`,
                pc.selected,
                link
            );
        }
        dialog.endControlGroup();
        dialog.addSeparator();

        dialog.addSubTitle('Consumables');
        // REVISIT put a section here to provider a player picker for who received what consumable
        dialog.addSeparator();
        dialog.addSubTitle('Current Totals');
        dialog.beginControlGroup();
        let count = module.pcs.count();
        dialog.addTextLine(`${count} Character${count!==1?'s':''} at ${module.pcs.averagePartyLevel()} APL`);
        if (module.hasTierRewardsDifference()) {
            // if hard cover, double treasure award for Tier 3+ characters
            dialog.addTextLine(`${module.advancementAward()} ACP, ${module.treasureAward()} TCP for Tier 1 & 2 Characters`);
            const explicitAwards = module.checkpoints.current.some(checkpoint => {
                return checkpoint.awarded.value();
            });
            if (explicitAwards) {
                // there should not be explicit check point awards in a hard cover, because the rules assume
                // time-based awards, so make the DM figure this out if the rules allow this in the future
                dialog.addTextLine(`You must manually calculate the treasure award for Tier 3 & 4 Characters`);
            } else {
                dialog.addTextLine(`${module.advancementAward()} ACP, ${2 * module.treasureAward()} TCP for Tier 3 & 4 Characters`);
            }
        } else {
            dialog.addTextLine(`${module.advancementAward()} ACP, ${module.treasureAward()} TCP`);
        }
        dialog.endControlGroup();
        dialog.addSeparator();
        dialog.addCommand('Preview & Send to Players', 'preview', { command: context.command });
        return new DialogResult(DialogResult.Destination.Caller, dialog.render());
    }
}
