/**
 * @since 2020-03-25 09:12
 * @author vivaxy
 */
import * as vscode from 'vscode';
import * as configuration from '../configuration';
import createSimpleQuickPick from './quick-pick';

export enum PROMPT_TYPES {
  QUICK_PICK,
  INPUT_BOX,
  CONFIGURIABLE_QUICK_PICK,
}

type Item = {
  label: string;
  detail?: string;
  description?: string;
  alwaysShow?: boolean;
};

export type Prompt = { name: string; type: PROMPT_TYPES } & Options &
  Partial<QuickPickOptions> &
  Partial<InputBoxOptions> &
  Partial<ConfiguriableQuickPickOptions>;

type Options = {
  placeholder: string;
  format?: (input: string) => string;
  step: number;
  totalSteps: number;
};

type QuickPickOptions = {
  items: Item[];
  noneItem?: Item;
} & Options;

async function createQuickPick({
  placeholder,
  items = [],
  format = (i: string) => i,
  step,
  totalSteps,
  noneItem,
}: QuickPickOptions): Promise<string> {
  const pickerItems = items;
  if (noneItem) {
    pickerItems.unshift(noneItem);
  }

  const selectedItems = await createSimpleQuickPick<Item>({
    placeholder,
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true,
    items,
    step,
    totalSteps,
  });

  let selectedValue = selectedItems[0].label;
  if (noneItem && selectedValue === noneItem.label) {
    selectedValue = '';
  }
  return format(selectedValue);
}

type InputBoxOptions = {
  validate?: (value: string) => string | undefined;
} & Options;

function createInputBox({
  placeholder,
  format = (i) => i,
  step,
  totalSteps,
  validate = () => undefined,
}: InputBoxOptions): Promise<string> {
  return new Promise(function (resolve, reject) {
    const input = vscode.window.createInputBox();
    input.step = step;
    input.totalSteps = totalSteps;
    input.ignoreFocusOut = true;
    input.placeholder = placeholder;
    input.onDidChangeValue(function () {
      try {
        input.validationMessage = validate(input.value);
      } catch (e) {
        reject(e);
      }
    });
    input.onDidAccept(function () {
      try {
        input.validationMessage = validate(input.value);
        if (input.validationMessage) {
          return;
        }
        const result = format(input.value);
        input.dispose();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
    input.prompt = placeholder;
    input.show();
  });
}

type ConfiguriableQuickPickOptions = {
  configurationKey: keyof configuration.Configuration;
  newItem: Item;
  newItemPlaceholder: string;
  addNoneOption: boolean;
  validate?: (value: string) => string | undefined;
} & QuickPickOptions;

async function createConfiguriableQuickPick({
  placeholder,
  format = (i) => i,
  step,
  totalSteps,
  configurationKey,
  newItem,
  noneItem,
  newItemPlaceholder,
  validate = () => undefined,
}: ConfiguriableQuickPickOptions): Promise<string> {
  const currentValus: string[] = configuration.get<string[]>(configurationKey);
  const items: Item[] = currentValus.map(function (value) {
    return {
      label: value,
      description: '',
      detail: 'From workspace configuration.',
    };
  });
  items.push(newItem);
  let selectedValue = await createQuickPick({
    placeholder,
    items,
    step,
    totalSteps,
    noneItem,
  });
  if (selectedValue === newItem.label) {
    selectedValue = await createInputBox({
      placeholder: newItemPlaceholder,
      step,
      totalSteps,
      validate,
    });
    if (selectedValue) {
      configuration.update(configurationKey, [...currentValus, selectedValue]);
    }
  }
  return format(selectedValue);
}

export default {
  [PROMPT_TYPES.QUICK_PICK]: createQuickPick,
  [PROMPT_TYPES.INPUT_BOX]: createInputBox,
  [PROMPT_TYPES.CONFIGURIABLE_QUICK_PICK]: createConfiguriableQuickPick,
};
