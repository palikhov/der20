import { clone, ConfigurationTermination, ParserContext, Result, Success, DialogResult } from 'der20/library';
import { ConfigurationArray } from 'der20/library';
import { ConfigurationBoolean, ConfigurationDate, ConfigurationFloat, ConfigurationInteger } from 'der20/library';
import { ConfigurationChangeHandling } from 'der20/library';
import { ConfigurationEnumerated } from 'der20/library';
import { ConfigurationIntermediateNode } from 'der20/library';
import { ConfigurationValue } from 'der20/library';
import { ConfigurationString } from 'der20/library';
import { PlayerCharacters } from './player_characters';

export class CheckPoint {
    // can't be undefined, because we need to detect that we can load it
    id: string = null;

    name: ConfigurationString = new ConfigurationString(ConfigurationValue.UNSET);
    advancement: ConfigurationInteger = new ConfigurationInteger(1);
    treasure: ConfigurationInteger = new ConfigurationInteger(1);
    dm: ConfigurationBoolean = new ConfigurationBoolean(true);
    players: ConfigurationBoolean = new ConfigurationBoolean(true);
    awarded: ConfigurationBoolean = new ConfigurationBoolean(false);
}

// can't use enum type in generic, so we use a list of possible values instead
export const Rarity: string[] = [ "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Unique" ];

export class Unlock {
    // can't be undefined, because we need to detect that we can load it
    id: string = null;

    // name of item
    name: ConfigurationString = new ConfigurationString(ConfigurationValue.UNSET);

    // item description including flavor text
    description: ConfigurationString = new ConfigurationString(ConfigurationValue.UNSET);

    // rarity value, capitalized 
    rarity: ConfigurationEnumerated = new ConfigurationEnumerated(ConfigurationValue.UNSET, Rarity);

    // tier restriction for item
    tier: ConfigurationInteger = new ConfigurationInteger(ConfigurationValue.UNSET);

    // item is considered to be from this table for trading purposes
    table: ConfigurationString = new ConfigurationString(ConfigurationValue.UNSET);

    // can unlock be awarded to players?
    players: ConfigurationBoolean = new ConfigurationBoolean(true);

    // can unlock be awarded to DM?
    dm: ConfigurationBoolean = new ConfigurationBoolean(false);

    // actually awarded for this session?
    awarded: ConfigurationBoolean = new ConfigurationBoolean(false);
}

export class LeagueModuleDefinition implements ConfigurationChangeHandling, ConfigurationTermination {
    // can't be undefined, because we need to detect that we can load it
    id: string = null;

    name: ConfigurationString = new ConfigurationString(ConfigurationValue.UNSET);
    checkpoints: ConfigurationArray<CheckPoint> = new ConfigurationArray<CheckPoint>('checkpoint', CheckPoint);
    unlocks: ConfigurationArray<Unlock> = new ConfigurationArray<Unlock>('unlock', Unlock);
    tier: ConfigurationInteger = new ConfigurationInteger(1);
    season: ConfigurationInteger = new ConfigurationInteger(ConfigurationValue.UNSET);
    hardcover: ConfigurationBoolean = new ConfigurationBoolean(false);
    level: LeagueModule.Level = new LeagueModule.Level();
    duration: ConfigurationFloat = new ConfigurationFloat(4);
    hourly: LeagueModule.Hourly = new LeagueModule.Hourly();

    minimumLevelForTier(): number {
        switch (this.tier.value()) {
            case 1:
                return 1;
            case 2:
                return 5;
            case 3:
                return 11;
            case 4:
                return 17;
            default:
                return 1;
        }
    }

    maximumLevelForTier(): number {
        switch (this.tier.value()) {
            case 1:
                return 4;
            case 2:
                return 10;
            case 3:
                return 16;
            case 4:
                return 20;
            default:
                return 20;
        }
    }

    hourlyAdvancement(): number {
        if ((this.season.value() < 8) || (this.hardcover.value())) {
            return 1;
        }
        return 0;
    }

    hourlyTreasure(): number {
        let multiplier = 1;
        if ((this.tier.value() > 2) && (!this.hasTierRewardsDifference())) {
            multiplier = 2;
        }
        return multiplier * this.hourlyAdvancement();
    }

    defaultDuration(): number {
        if (this.hardcover.value()) {
            return 0;
        } else {
            return 4;
        }
    }

    hasTierRewardsDifference(): boolean {
        return (this.hardcover.value() && (this.level.maximum.value() > 10) && (this.level.minimum.value() < 11));
    }

    handleChange(keyword: string) {
        switch (keyword) {
            case 'tier':
                this.level.minimum.default = this.minimumLevelForTier();
                this.level.maximum.default = this.maximumLevelForTier();
                this.hourly.treasure.default = this.hourlyTreasure();
                break;
            case 'season':
                this.hourly.advancement.default = this.hourlyAdvancement();
                this.hourly.treasure.default = this.hourlyTreasure();
                break;
            case 'hardcover':
                this.hourly.advancement.default = this.hourlyAdvancement();
                this.hourly.treasure.default = this.hourlyTreasure();
                this.duration.default = this.defaultDuration();
                break;
            case 'level':
                this.hourly.treasure.default =  this.hourlyTreasure();
                break;
            default:
                // ignore
        }
    }

    handleEndOfCommand(context: ParserContext): Result {
        if (!context.rest.startsWith('define ')) {
            return new Success('no configuration changed');
        }
        let dialog = new context.dialog();
        const link = { 
            command: context.command,
            prefix: context.rest,
            followUps: [ context.rest ]
        };
        dialog.addTitle(`Definition for Module '${this.id}'`);
        dialog.beginControlGroup();
        dialog.addEditControl('Module Name', 'name', this.name, link);
        dialog.addEditControl('Season', 'season', this.season, link);
        dialog.addEditControl('Hard Cover', 'hardcover', this.hardcover, link);
        dialog.addEditControl('Tier', 'tier', this.tier, link);
        dialog.addEditControl('Minimum Level', 'level minimum', this.level.minimum, link);
        dialog.addEditControl('Maximum Level', 'level maximum', this.level.maximum, link);
        dialog.addEditControl('Advancement/hr', 'hourly advancement', this.hourly.advancement, link);
        dialog.addEditControl('Treasure/hr', 'hourly treasure', this.hourly.treasure, link);
        dialog.addEditControl('Maximum Duration', 'duration', this.duration, link);
        dialog.endControlGroup();
        return new DialogResult(DialogResult.Destination.Caller, dialog.render());
    }
}

export class LeagueModule extends LeagueModuleDefinition {
    session: ConfigurationString = new ConfigurationString(ConfigurationValue.UNSET);
    start: ConfigurationDate = new ConfigurationDate(ConfigurationValue.UNSET);
    stop: ConfigurationDate = new ConfigurationDate(ConfigurationValue.UNSET);

    // @keyword('pc')
    pcs: PlayerCharacters = new PlayerCharacters();

    treasureAward(): number {
        // sum all awarded treasure from checkpoints
        let treasure = this.checkpoints.current.map((checkpoint) => {
            if (checkpoint.awarded.value()) {
                return checkpoint.treasure.value();
            } else {
                return 0;
            }
        }).reduce((previous, current) => {
            return previous + current;
        }, 0);

        let hours = this.hoursAward();
        if (hours <= 0.0) {
            // start and stop may not be configured
            return treasure;
        }

        // add any hourly treasure, which should be mutually exclusive with checkpoints
        // but there may be modules in the future that change this
        treasure += this.hourly.treasure.value() * hours;
        return treasure;
    }

    advancementAward(): number {
        // sum all awarded advancement from checkpoints
        let advancement = this.checkpoints.current.map((checkpoint) => {
            if (checkpoint.awarded.value()) {
                return checkpoint.advancement.value();
            } else {
                return 0;
            }
        }).reduce((previous, current) => {
            return previous + current;
        }, 0);

        let hours = this.hoursAward();
        if (hours <= 0.0) {
            // start and stop may not be configured
            return advancement;
        }
   
        // add any hourly advancement, which should be mutually exclusive with checkpoints
        // but there may be modules in the future that change this
        advancement += this.hourly.advancement.value() * hours;
        return advancement;
    }

    hoursAward(): number {
        let hours = (this.stop.value() - this.start.value()) / (60 * 60 * 1000);
        if (Number.isNaN(hours)) {
            return 0;
        }
        if (hours <= 0) {
            return 0;
        }
        if (this.duration.value() <= 0) {
            // no duration limit
            return Math.floor(hours);
        }
        if (hours > this.duration.value()) {
            return Math.floor(this.duration.value());
        }
        return Math.floor(hours);
    }
    
    updateTierFromAPL() {
        if (!this.hardcover.value()) {
            return;
        }
        const apl = this.pcs.averagePartyLevel();
        let tier = 1;
        if (apl >= 16.5) {
            tier = 4;
        } else if (apl >= 10.5) {
            tier = 3;
        } else if (apl >= 4.5) {
            tier = 2;
        }
        this.tier.default = tier;
        if (!this.tier.hasConfiguredValue()) {
            this.handleChange('tier');
        }
    }

    handleChange(keyword: string) {
        switch (keyword) {
            case 'start':
                this.pcs.scan();
                this.updateTierFromAPL();
                break;
            case 'pc':
                this.updateTierFromAPL();
                break;
            default:
                super.handleChange(keyword);
        }
    }
} 

export namespace LeagueModule {
    export class Level extends ConfigurationIntermediateNode {
        minimum: ConfigurationInteger = new ConfigurationInteger(1);
        maximum: ConfigurationInteger = new ConfigurationInteger(20);

        clone(): Level {
            return clone(LeagueModule.Level, this);
        }
    }
    export class Hourly extends ConfigurationIntermediateNode {
        advancement: ConfigurationFloat = new ConfigurationFloat(0);
        treasure: ConfigurationFloat = new ConfigurationFloat(0);

        clone(): Hourly {
            return clone(LeagueModule.Hourly, this);
        }
    }
}