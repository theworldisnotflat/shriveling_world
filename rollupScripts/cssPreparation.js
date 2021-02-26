import purgecss from 'purgecss';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import comments from 'postcss-discard-comments';
import { outputFileSync } from 'fs-extra';

const purge = new purgecss();
const post = postcss([autoprefixer({ add: false }), cssnano, comments({ removeAll: true })]);

export async function cssPreparation() {
    const purgeCSSResults = await purge.purge({
        content: [
            __dirname + '/src/**/*.html',
            __dirname + '/src/**/**/*.svelte',
            __dirname + '/src/**/**/**.ts',
            __dirname + '/static/**/**/**.html',
        ],
        css: [__dirname + 'static/**/*.css'],
        fontFace: true,
        variables: true,
        whitelistPatterns: [/^title/, /^is-/, /^h[0-9]/, /^tbody/, /^tr/, /^td/, /^th/],
    });
    await Promise.all(
        purgeCSSResults.map(async(item) => {
            let css = (await post.process(item.css, { from: item.file })).css;
            outputFileSync(item.file, css);
        })
    );
}