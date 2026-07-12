import path, { resolve } from "path";
import { defineConfig } from "vite";
import minimist from "minimist";
import { viteStaticCopy } from "vite-plugin-static-copy";
import livereload from "rollup-plugin-livereload";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import zipPack from "vite-plugin-zip-pack";
import fg from "fast-glob";

const args = minimist(process.argv.slice(2));
const isWatch = args.watch || args.w || false;
// 开发时将其修改为你的插件路径
const devDistDir = "/Users/hqweay/SiYuan/data/plugins/siyuan-panda-navigation";
const distDir = isWatch ? devDistDir : "./dist";

console.log("isWatch=>", isWatch);
console.log("distDir=>", distDir);

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        {
          src: "./README*.md",
          dest: "./",
        },
        {
          src: "./plugin.json",
          dest: "./",
        },

        {
          src: "./preview.png",
          dest: "./",
        },
        {
          src: "./screenshots/**",
          dest: "./screenshots",
        },
        {
          src: "./icon.png",
          dest: "./",
        },
        {
          src: "./public/skills/siyuan-panda-navigation",
          dest: "./skills/",
        },
      ],
    }),
  ],

  define: {
    "process.env.DEV_MODE": `"${isWatch}"`,
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },

  build: {
    outDir: distDir,
    emptyOutDir: false,
    sourcemap: false,
    minify: !isWatch,

    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      plugins: [
        ...(isWatch
          ? [
              livereload({
                watch: devDistDir,
                clientUrl: "http://localhost:35729/livereload.js?snipver=1",
              }),
              {
                name: "watch-external",
                async buildStart() {
                  const files = await fg([
                    "./README*.md",
                    "./plugin.json",
                  ]);
                  for (let file of files) {
                    this.addWatchFile(file);
                  }
                },
              },
            ]
          : [
              zipPack({
                inDir: "./dist",
                outDir: "./",
                outFileName: "package.zip",
              }),
            ]),
      ],

      external: ["siyuan", "process"],

      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        },
      },
    },
  },
});
