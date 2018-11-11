import { ConfigurationStep, CollectionItem } from "derlib/config/atoms";
import { Result } from "derlib/config/result";

export interface Dialog {
    beginControlGroup(): void;
    endControlGroup(): void;
    addEditControl<T>(label: string, path: string, config: ConfigurationStep<T>): void;
    addChoiceControlGroup(label: string, prefix: string, choices: CollectionItem[], suffix: string): void;
    addSelectionGroup(label: string, prefix: string, choices: { label: string, result: string }[]): void;
    addCommand(label: string, target: string): void;
    addExternalLinkButton(label: string, target: string): void;
    addTitle(text: string): void;
    addSubTitle(text: string): void;
    addSeparator(): void;
    addTextLine(text: string): void;
    addIndentedTextLine(text: string): void;
    getDateText(value: number): string;
    renderCommandEcho(line: string, resultType: Result.Kind): string;
    render(): string;
}

export interface DialogFactory {
    new(commandPrefix: string): Dialog;
}