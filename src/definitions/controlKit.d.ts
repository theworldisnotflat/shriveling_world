declare module '@brunoimbrizi/controlkit' {
  export interface IControlKitOptions {
    history?: boolean;
    loadAndSave?: boolean;
    opacity?: number;
    panelsClosable?: boolean;
    useExternalStyle?: boolean;
    enable?: boolean;
    style?: boolean;
    styleString?: string;
    parentDomElementId?: string;
  }
  export interface IPanelOptions {
    label?: string;
    width?: number;
    height?: number;
    ratio?: number;
    align?: 'right' | 'left';
    fixed?: boolean;
    position?: number[];
    opacity?: number;
    dock?: { align: LayoutMode, resizable: boolean };
    valign?: LayoutMode;
    enable?: boolean;
    vconstraint?: boolean;
  }
  export interface IGetComponentOptions {
    label?: string;
    key?: string;
  }
  export enum LayoutMode {
    LEFT = 'left',
    RIGHT = 'right',
    TOP = 'top',
    BOTTOM = 'bottom',
    NONE = 'none',
  }
  export interface IGroupOptions {
    label?: string;
    useLabel?: boolean;
    enable?: boolean;
    height?: number;
  }
  export interface IStringOptions {
    label?: string;
    onChange?: () => void;
    presets?: string[];
  }
  export interface INumberInputOptions {
    label?: string;
    onChange?: () => void;
    step?: number;
    dp?: number;
    presets?: number[];
  }
  export interface IRangeOptions {
    label?: string;
    onChange?: () => void;
    step?: number;
    dp?: number;
  }
  export interface ICheckboxOptions {
    label?: string;
    onChange?: () => void;
  }
  export interface IColorOptions {
    label?: string;
    onChange?: () => void;
    colorMode?: 'hex' | 'rgb' | 'rgbfv';
    presets?: string[];
  }
  export interface ISelectOptions {
    label?: string;
    onChange?: (index?: number) => void;
    target?: string;
  }
  export interface ISliderOptions {
    label?: string;
    onChange?: () => void;
    onFinish?: () => void;
    step: number;
    dp: number;
  }
  export class Component {

  }
  export class Panel {
    constructor(controlKit: ControlKit, options: IPanelOptions)
    public enable(): void;
    public disable(): void;
    public addGroup(options?: IGroupOptions): Panel;
    public addSubGroup(options?: IGroupOptions): Panel;
    public addStringInput(object: any, property: string, options?: IStringOptions): Panel;
    public addNumberInput(object: any, property: string, options?: INumberInputOptions): Panel;
    public addRange(object: any, property: string, options?: IRangeOptions): Panel;
    public addCheckbox(object: any, property: string, options?: ICheckboxOptions): Panel;
    public addColor(object: any, property: string, options?: IColorOptions): Panel;
    public addButton(label: string, onPress: () => void, params?: { label?: string }): Panel;
    public addSelect(object: any, property: string, options?: ISelectOptions): Panel;
    public addSlider(object: any, property: string, range: string, options?: ISliderOptions): Panel;
public addFunctionPlotter(object: any, property: string, options?: IStringOptions): Panel;
  }
  export type nodeType = 'div' | 'text' | 'button' | 'select' | 'checkbox' | 'option' | 'ul' | 'li' | 'span' | 'textarea';
  export class Node {
    public static getNodeByElement(element: HTMLElement): Node;
    public static getNodeById(id: string): Node;
    constructor(type?: nodeType)
  }

  export class ControlKit {
    constructor(options?: IControlKitOptions)
    public addPanel(options?: IPanelOptions): Panel;
    public update(): void;
    public getComponentBy(options: IGetComponentOptions): Component;
    public historyIsEnabled(): boolean;
    public statesAreEnabled(): boolean;
    public panelsAreClosable(): boolean;
    public enable(): void;
    public disable(): void;
    public setShortcutEnable(char: string): void;
    public getNode(): Node;
    public destroy(): void;

  }
}
