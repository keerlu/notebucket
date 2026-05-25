const { DateTime } = require('luxon');

module.exports = function (eleventyConfig) {
  // ---------------------------------------------------------------------------
  // Passthrough
  // ---------------------------------------------------------------------------
  eleventyConfig.addPassthroughCopy('src/css');
  eleventyConfig.addPassthroughCopy('src/content');
  eleventyConfig.addPassthroughCopy('src/CNAME');

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  eleventyConfig.addFilter('readableDate', (dateObj) => {
    return DateTime.fromJSDate(new Date(dateObj), { zone: 'utc' }).toFormat('d LLLL yyyy');
  });

  eleventyConfig.addFilter('isoDate', (dateObj) => {
    return DateTime.fromJSDate(new Date(dateObj), { zone: 'utc' }).toISO();
  });

  eleventyConfig.addFilter('limit', (arr, n) => arr.slice(0, n));

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------

  // All published posts, newest first
  eleventyConfig.addCollection('posts', (collectionApi) => {
    return collectionApi
      .getFilteredByGlob('src/posts/*.md')
      .filter(p => !p.data.draft)
      .reverse();
  });

  // One collection per tag, e.g. collections.tag_derrida
  // Also builds the global tag list used by the /tags/ index
  eleventyConfig.addCollection('tagList', (collectionApi) => {
    const tagSet = new Set();
    collectionApi.getFilteredByGlob('src/posts/*.md').forEach(item => {
      (item.data.tags || []).forEach(tag => tagSet.add(tag));
    });
    return [...tagSet].sort();
  });

  // ---------------------------------------------------------------------------
  // Directory config
  // ---------------------------------------------------------------------------
  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      data: '_data',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
};
