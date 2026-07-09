export interface BuiltinCommand {
    id: string;
    title: string;
    requiresParam: boolean;
    paramPlaceholder?: string;
    inputType?: "text" | "textarea" | "select";
    paramOptions?: { label: string; value: string }[];
    loadParamOptions?: () => Promise<{ label: string; value: string }[]>;
    execute: (plugin: any, param?: string) => Promise<void> | void;
}
