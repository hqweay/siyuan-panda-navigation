export interface BuiltinCommand {
    id: string;
    title: string;
    requiresParam: boolean;
    paramPlaceholder?: string;
    execute: (plugin: any, param?: string) => Promise<void> | void;
}
