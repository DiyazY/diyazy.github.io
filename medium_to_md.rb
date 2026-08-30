# credits to https://gitlab.com/-/snippets/2532776, @jessp01
require 'feedjira'
require 'httparty'
require 'nokogiri'
require 'reverse_markdown'
require 'fileutils'

if ARGV.length < 2
	puts "Usage: " + __FILE__ + " <medium user without the '@'> </path/to/output>"
	exit 1
end

medium_user = ARGV[0]
output_dir = ARGV[1] || "./_posts"

FileUtils.mkdir_p(output_dir)

xml = HTTParty.get("https://medium.com/feed/@#{medium_user}").body
feed = Feedjira.parse(xml)

feed.entries.each do |e|
	# normalise `title` to arrive at a reasonable filename
	published_date = e.published.strftime("%Y-%m-%d")
	filename = output_dir + '/' + published_date + '-' + e.title.gsub(/[^0-9a-z\s]/i, '').gsub(/\s+/,'-') + '.md'
	puts e
	if File.exist?(filename)
		puts "#{filename} already exists. Skipping.."
		next
	end

	
	content = e.content || e.summary # if article is behind paywall, content will be nil
	parseHTML = Nokogiri::HTML(content)
	img = parseHTML.xpath("//img")[0]['src'].sub!(/http(s)?:/,'')

	# Medium's RSS repeats the post title as the first heading; the post layout
	# already renders the title as the page h1, so drop the duplicate.
	# POSIX [[:space:]] rather than \s: unlike \s it matches the non-breaking
	# spaces Medium peppers its headings with.
	normalize = ->(s) { s.to_s.gsub(/[[:space:]]+/, ' ').strip.downcase }
	first_heading = parseHTML.at_css('h1, h2, h3, h4')
	first_heading.remove if first_heading && normalize.(first_heading.text) == normalize.(e.title)

	# Medium exports section headings as h3 and subheads as h4. Under the
	# layout's h1 that breaks the outline — and the site's TOC only scans h2s.
	# Snapshot both lists before renaming so promoted h4s aren't promoted twice.
	h3s = parseHTML.css('h3')
	h4s = parseHTML.css('h4')
	h3s.each { |h| h.name = 'h2' }
	h4s.each { |h| h.name = 'h3' }

	# Medium images arrive with empty alt text; the figcaption, when present,
	# is the description the author actually wrote.
	parseHTML.css('figure').each do |fig|
		fig_img = fig.at_css('img')
		caption = fig.at_css('figcaption')
		next unless fig_img && caption
		fig_img['alt'] = caption.text.strip if fig_img['alt'].to_s.strip.empty?
	end

	# Strip combining marks (Medium once tagged a post "ti̇ktok", dotted i and
	# all) and downcase, so tag filtering and related-posts matching work.
	tags = e.categories
		.map { |t| t.to_s.unicode_normalize(:nfkd).gsub(/\p{Mn}/, '').downcase.strip }
		.reject(&:empty?).uniq.join(', ')
	original_link = e.url

	result = ReverseMarkdown.convert(parseHTML.at_css('body').inner_html).gsub(/\\n/,"\n")

	# Remove "Continue reading on Medium" links that may be in the content
	result.gsub!(/\[Continue reading on Medium.*?\]\(.*?\)/, '')

	meta = <<-META
---
layout: post
author: #{e.author}
title: "#{e.title.gsub('"', '\\"')}"
date: #{e.published}
background: https:#{img}
excerpt_separator: <!--more-->
tags: [#{tags}]
original_link: #{original_link}
---
	META

	File.write(filename, meta + result)
end
