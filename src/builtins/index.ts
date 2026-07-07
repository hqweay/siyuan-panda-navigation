import { BuiltinCommand } from "./types";

export const builtinCommands: Record<string, BuiltinCommand> = {};

// 使用 Vite 的 import.meta.glob 自动扫描 commands 目录下的所有 ts 文件
const modules = import.meta.glob('./commands/*.ts', { eager: true });

for (const path in modules) {
    const mod = modules[path] as Record<string, any>;
    for (const key in mod) {
        const exp = mod[key];
        // 如果导出的是一个数组（例如 documentCommands）
        if (Array.isArray(exp)) {
            exp.forEach(cmd => {
                if (cmd && cmd.id && typeof cmd.execute === 'function') {
                    builtinCommands[cmd.id] = cmd;
                }
            });
        } 
        // 如果导出的是单个命令对象
        else if (exp && exp.id && typeof exp.execute === 'function') {
            builtinCommands[exp.id] = exp;
        }
    }
}

export const builtinCommandList = Object.values(builtinCommands);
