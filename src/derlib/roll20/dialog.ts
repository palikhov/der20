import {
    ConfigurationStep,
    ConfigurationString,
    ConfigurationInteger,
    ConfigurationBoolean,
    ConfigurationDate,
    ConfigurationFloat,
    CollectionItem
} from 'derlib/config/atoms';
import { Dialog } from 'derlib/ui';
import { ConfigurationEnumerated } from 'derlib/config/enum';

// styling and layout based on https://github.com/RobinKuiper/Roll20APIScripts, with thanks
export class Der20ChatDialog implements Dialog {
    text: string[] = [];
    commandPrefix: string;
    static readonly dialogStyle: string = 'margin-top: 0.5em; overflow: hidden; border: 1px solid Black; padding: 5px; border-radius: 5px;';
    static readonly buttonBaseStyle: string =
        'min-width: 6em; text-decoration: none; background-color: White; border: 1px solid #eeeeee; border-radius: 3px; padding-left: 5px; padding-right: 5px; padding-top: 0px; padding-bottom: 0px; text-align: center; float: right;';
    static readonly buttonStyle: string = Der20ChatDialog.buttonBaseStyle + 'color: Black;';
    static readonly defaultedButtonStyle: string = Der20ChatDialog.buttonBaseStyle + 'color: #aaaaaa;';
    static readonly commandStyle: string =
        'text-decoration: none; background-color: #000; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center; margin: auto; width: 98%; display: block; float: none;';
    static readonly externalLinkButtonStyle: string =
        'background-color: #0000ff; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center; margin: auto; width: 98%; display: block; float: none;';
    static readonly labelStyle: string = 'float: left;';
    static readonly groupStyle: string = 'overflow: hidden; list-style: none; padding: 0; margin: 0;';
    static readonly itemStyle: string = 'overflow: hidden; margin-top: 5px;';
    static readonly separatorStyle: string = 'margin-top: 1.0em; margin-bottom: 0.5em;';
    static readonly undefinedLabel = '[ NONE ]';

    constructor(commandPrefix: string) {
        this.commandPrefix = commandPrefix;
        this.text.push(`<div style="${Der20ChatDialog.dialogStyle}">`);
    }

    beginControlGroup() {
        this.text.push(`<ul style="${Der20ChatDialog.groupStyle}">`);
    }

    endControlGroup() {
        this.text.push('</ul>');
    }

    addButton(label: string, target: string) {
        this.text.push(`<a style="${Der20ChatDialog.buttonStyle}", href="${this.commandPrefix}${target}">${label}</a>`);
    }

    private addDefaultedButton(label: string, target: string) {
        this.text.push(`<a style="${Der20ChatDialog.defaultedButtonStyle}", href="${this.commandPrefix}${target}">${label}</a>`);
    }

    addEditControl<T>(label: string, path: string, config: ConfigurationStep<T>) {
        this.text.push(`<li style="${Der20ChatDialog.itemStyle}">`);
        this.text.push(`<span style="${Der20ChatDialog.labelStyle}">${label}</span>`);
        let text: string = '';
        let link: string = '';
        if (config instanceof ConfigurationString) {
            // already a string, but need to assert type
            let value = (<ConfigurationString>config).value();
            text = this.getStringText(value);
            link = `${path} ?{${label}}`;
        } else if (config instanceof ConfigurationInteger || config instanceof ConfigurationFloat) {
            let value = config.value();
            text = this.getNumberText<T>(value);
            // REVISIT do we have an integer control available somewhere?
            link = `${path} ?{${label} (Integer)}`;
        } else if (config instanceof ConfigurationDate) {
            let value = (<ConfigurationDate>config).value();
            text = this.getDateText(value);
            // REVISIT do we have an integer or date control available somewhere?
            link = `${path} ?{${label} (in hours before now, e.g. 3.5 or date string)}`;
        } else if (config instanceof ConfigurationBoolean) {
            text = `${(<ConfigurationBoolean>config).value() === true}`;
            link = `${path} ${!config.value()}`;
        } else if (config instanceof ConfigurationEnumerated) {
            text = this.getStringText((<ConfigurationEnumerated>config).value());
            let choices = (<ConfigurationEnumerated>config).choices().map((value) => {
                if (value.length < 1) {
                    return `${Der20ChatDialog.undefinedLabel},`;
                }
                return `${value},${value}`;
            }).join('|');
            link = `${path} ?${label}|${choices}`;
        }
        if (config.hasConfiguredValue()) {
            this.addButton(text, link);
        } else {
            this.addDefaultedButton(text, link);
        }
        this.text.push('</li>');
    }

    addTextLine(label: string) {
        this.text.push(`<li style="${Der20ChatDialog.itemStyle}">`);
        this.text.push(label);
        this.text.push('</li>');
    }

    addIndentedTextLine(label: string) {
        this.text.push(`<li style="${Der20ChatDialog.itemStyle} margin-left: 3em;">`);
        this.text.push(label);
        this.text.push('</li>');
    }

    getStringText(value: string) {
        if (value === ConfigurationStep.NO_VALUE) {
            return Der20ChatDialog.undefinedLabel;
        }
        return value;
    }

    getNumberText<T>(value: T) {
        if (value === ConfigurationStep.NO_VALUE) {
            return Der20ChatDialog.undefinedLabel;
        }
        return `${value}`;
    }

    getDateText(value: number) {
        if (value === ConfigurationStep.NO_VALUE) {
            return Der20ChatDialog.undefinedLabel;
        }
        return new Date(value).toUTCString();
    }

    addChoiceControlGroup(label: string, prefix: string, choices: CollectionItem[], suffix: string): void {
        this.beginControlGroup();
        for (let choice of choices) {
            this.text.push(`<li style="${Der20ChatDialog.itemStyle}">`);
            this.text.push(`<span style="${Der20ChatDialog.labelStyle}">${choice.name.value()}</span>`);
            let link: string = `${prefix} ${choice.id} ${suffix}`;
            this.addButton(choice.id.substr(0, 10), link);
            this.text.push('</li>');
        }
        this.endControlGroup();
    }

    addCommand(label: string, target: string) {
        this.text.push(`<a style="${Der20ChatDialog.commandStyle}", href="${this.commandPrefix}${target}">${label}</a>`);
    }

    addExternalLinkButton(label: string, target: string) {
        this.text.push(`<a style="${Der20ChatDialog.externalLinkButtonStyle}", href="${target}">${label}</a>`);
    }

    addTitle(label: string) {
        this.text.push(`<h2>${label}</h2>`);
    }

    addSubTitle(label: string) {
        this.text.push(`<h3>${label}</h3>`);
    }

    addSeparator() {
        this.text.push(`<hr style='${Der20ChatDialog.separatorStyle}'>`);
    }

    render() {
        this.text.push('</div>');
        return this.text.join('');
    }
}
