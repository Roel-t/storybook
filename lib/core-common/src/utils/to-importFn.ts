import dedent from 'ts-dedent';

import type { NormalizedStoriesSpecifier } from '../types';
import { globToRegexp } from './glob-to-regexp';

export function webpackIncludeRegexp(specifier: NormalizedStoriesSpecifier) {
  const { directory, files } = specifier;

  // It appears webpack passes *something* similar to the absolute path to the file
  // on disk (prefixed with something unknown) to the matcher.
  // We don't want to include the absolute path in our bundle, so we will just pull any leading
  // `./` or `../` off our directory and match on that.
  // It's imperfect as it could match extra things in extremely unusual cases, but it'll do for now.
  // NOTE: directory is "slashed" so will contain only `/` (no `\`), even on windows
  const directoryWithoutLeadingDots = directory.replace(/^(\.+\/)+/, '/');
  const webpackIncludeGlob = ['.', '..'].includes(directory)
    ? files
    : `${directoryWithoutLeadingDots}/${files}`;
  const webpackIncludeRegexpWithCaret = globToRegexp(webpackIncludeGlob);
  // picomatch is creating an exact match, but we are only matching the end of the filename
  return new RegExp(webpackIncludeRegexpWithCaret.source.replace(/^\^/, ''));
}

export function toImportFnPart(specifier: NormalizedStoriesSpecifier) {
  const { directory, importPathMatcher } = specifier;

  return dedent`
      async (path) => {
        if (!${importPathMatcher}.exec(path)) {
          return;
        }

        const pathRemainder = path.substring(${directory.length + 1});
        return import(
          /* webpackInclude: ${webpackIncludeRegexp(specifier)} */
          '${directory}/' + pathRemainder
        );
      }

  `;
}

export function toImportFn(stories: NormalizedStoriesSpecifier[]) {
  return dedent`
    const importers = [
      ${stories.map(toImportFnPart).join(',\n')}
    ];

    export async function importFn(path) {
      for (let i = 0; i < importers.length; i++) {
        const moduleExports = await importers[i](path);
        if (moduleExports) {
          return moduleExports;
        }
      }
    }
  `;
}
