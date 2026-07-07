export interface BuiltinCommand {
    id: string;
    title: string;
    requiresParam: boolean;
    paramPlaceholder?: string;
    inputType?: "text" | "textarea" | "select";
    execute: (plugin: any, param?: string) => Promise<void> | void;
}
