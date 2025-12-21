// imports for the various eleventy plugins (navigation & image)
const eleventyNavigationPlugin = require('@11ty/eleventy-navigation');
const { DateTime } = require('luxon');
const Image = require('@11ty/eleventy-img');
const path = require('path');
const fs = require('fs');

// Load translations
const translationsEn = JSON.parse(fs.readFileSync('./src/_data/translations/en.json', 'utf8'));
const translationsKo = JSON.parse(fs.readFileSync('./src/_data/translations/ko.json', 'utf8'));
const translations = { en: translationsEn, ko: translationsKo };

// allows the use of {% image... %} to create responsive, optimised images
async function imageShortcode(src, alt, className, loading, sizes = '(max-width: 600px) 400px, 850px') {
  if (alt === undefined) {
    throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
  }

  let metadata = await Image(`${src}`, {
    widths: [200, 400, 850, 1920, 2500],
    formats: ['webp', 'jpeg'],
    urlPath: '/images/',
    outputDir: './public/images',
    filenameFormat: function (id, src, width, format, options) {
      const extension = path.extname(src);
      const name = path.basename(src, extension);
      return `${name}-${width}w.${format}`;
    },
  });

  let lowsrc = metadata.jpeg[0];
  let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

  return `<picture class="${className}">
    ${Object.values(metadata)
      .map((imageFormat) => {
        return `  <source type="${imageFormat[0].sourceType}" srcset="${imageFormat
          .map((entry) => entry.srcset)
          .join(', ')}" sizes="${sizes}">`;
      })
      .join('\n')}
      <img
        src="${lowsrc.url}"
        width="${highsrc.width}"
        height="${highsrc.height}"
        alt="${alt}"
        loading="${loading}"
        decoding="async">
    </picture>`;
}

module.exports = function (eleventyConfig) {
  // adds the navigation plugin for easy navs
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // allows css, assets, robots.txt and CMS config files to be passed into /public
  eleventyConfig.addPassthroughCopy('./src/css/**/*.css');
  eleventyConfig.addPassthroughCopy('./src/assets');
  eleventyConfig.addPassthroughCopy('./src/admin');
  eleventyConfig.addPassthroughCopy('./src/_redirects');
  eleventyConfig.addPassthroughCopy({ './src/robots.txt': '/robots.txt' });

  // open on npm start and watch CSS files for changes
  eleventyConfig.setBrowserSyncConfig({
    open: true,
    files: './public/css/**/*.css',
  });

  // allows the {% image %} shortcode to be used for optimised images
  eleventyConfig.addNunjucksAsyncShortcode('image', imageShortcode);

  // ========================================
  // i18n FILTERS AND COLLECTIONS
  // ========================================

  // Translation filter: {{ 'site.title' | t(locale) }}
  eleventyConfig.addFilter('t', function(key, locale = 'en') {
    const keys = key.split('.');
    let value = translations[locale] || translations['en'];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  });

  // Get locale from page URL or data
  eleventyConfig.addFilter('getLocale', function(url) {
    if (url && url.startsWith('/ko')) return 'ko';
    return 'en';
  });

  // Generate localized URL
  eleventyConfig.addFilter('localeUrl', function(url, targetLocale, currentLocale) {
    if (!url) return url;
    
    // Remove current locale prefix if present
    let cleanUrl = url.replace(/^\/(en|ko)/, '');
    if (cleanUrl === '') cleanUrl = '/';
    
    // Add target locale prefix (none for English)
    if (targetLocale === 'ko') {
      return '/ko' + (cleanUrl === '/' ? '' : cleanUrl);
    }
    return cleanUrl;
  });

  // Get alternate language URL for language switcher
  eleventyConfig.addFilter('altLangUrl', function(url, currentLocale) {
    const targetLocale = currentLocale === 'en' ? 'ko' : 'en';
    if (!url) return url;
    
    if (currentLocale === 'ko') {
      // Currently Korean, switch to English
      return url.replace(/^\/ko/, '') || '/';
    } else {
      // Currently English, switch to Korean
      return '/ko' + url;
    }
  });

  // ========================================
  // DATE FILTERS
  // ========================================

  eleventyConfig.addFilter('postDate', (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
  });

  eleventyConfig.addFilter('postDateLocale', (dateObj, locale = 'en') => {
    const localeMap = { en: 'en-US', ko: 'ko-KR' };
    return DateTime.fromJSDate(dateObj)
      .setLocale(localeMap[locale] || 'en-US')
      .toLocaleString(DateTime.DATE_MED);
  });

  // ========================================
  // ARRAY/UTILITY FILTERS
  // ========================================

  eleventyConfig.addFilter('head', (array, n) => {
    if (!Array.isArray(array) || !array.length) return [];
    if (n < 0) return array.slice(n);
    return array.slice(0, n);
  });

  eleventyConfig.addFilter('slice', (array, start, end) => {
    if (!Array.isArray(array)) return [];
    return array.slice(start, end);
  });

  eleventyConfig.addNunjucksFilter('padStart', (value, length = 2, char = '0') => {
    return String(value ?? '').padStart(length, char);
  });

  // Filter by locale
  eleventyConfig.addFilter('filterByLocale', (array, locale) => {
    if (!Array.isArray(array)) return [];
    return array.filter(item => item.data?.locale === locale);
  });

  // ========================================
  // COLLECTIONS
  // ========================================

  // All posts (both languages)
  eleventyConfig.addCollection('allPosts', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/**/*.md').sort((a, b) => b.date - a.date);
  });

  // English posts (pinned posts first, then by date)
  eleventyConfig.addCollection('posts_en', function(collectionApi) {
    const posts = collectionApi.getFilteredByGlob('src/content/blog/en/*.md');
    // Sort: pinned posts first, then by date descending
    return posts.sort((a, b) => {
      const aIsPinned = a.data.tags && a.data.tags.includes('pinned');
      const bIsPinned = b.data.tags && b.data.tags.includes('pinned');
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      return b.date - a.date;
    });
  });

  // Korean posts (pinned posts first, then by date)
  eleventyConfig.addCollection('posts_ko', function(collectionApi) {
    const posts = collectionApi.getFilteredByGlob('src/content/blog/ko/*.md');
    return posts.sort((a, b) => {
      const aIsPinned = a.data.tags && a.data.tags.includes('pinned');
      const bIsPinned = b.data.tags && b.data.tags.includes('pinned');
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      return b.date - a.date;
    });
  });

  // Featured posts by locale
  eleventyConfig.addCollection('featured_en', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('featured'))
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection('featured_ko', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/ko/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('featured'))
      .sort((a, b) => b.date - a.date);
  });

  // Popular posts by locale
  eleventyConfig.addCollection('popular_en', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('popular'))
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection('popular_ko', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/ko/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('popular'))
      .sort((a, b) => b.date - a.date);
  });

  // Commented posts by locale
  eleventyConfig.addCollection('commented_en', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('commented'))
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection('commented_ko', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/ko/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('commented'))
      .sort((a, b) => b.date - a.date);
  });

  // Legacy collections for backwards compatibility during transition
  eleventyConfig.addCollection('post', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md').sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection('featured', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('featured'))
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection('popular', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('popular'))
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection('commented', function(collectionApi) {
    return collectionApi.getFilteredByGlob('src/content/blog/en/*.md')
      .filter(post => post.data.tags && post.data.tags.includes('commented'))
      .sort((a, b) => b.date - a.date);
  });

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      layouts: "_layouts",
      output: 'public',
    },
    htmlTemplateEngine: 'njk',
  };
};
