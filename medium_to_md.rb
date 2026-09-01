# credits to https://gitlab.com/-/snippets/2532776, @jessp01
require 'feedjira'
require 'httparty'
require 'nokogiri'
require 'reverse_markdown'
require 'fileutils'
require 'uri' # URI() below; loaded transitively today, made explicit so a gem change can't drop it

if ARGV.length < 2
	puts "Usage: " + __FILE__ + " <medium user without the '@'> </path/to/output>"
	exit 1
end

medium_user = ARGV[0]
output_dir = ARGV[1] || "./_posts"

FileUtils.mkdir_p(output_dir)

xml = HTTParty.get("https://medium.com/feed/@#{medium_user}").body
feed = Feedjira.parse(xml)

failed_titles = []
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
	# is the description the author actually wrote. Escape pipes: an unescaped
	# "|" in alt makes ![alt](src) plus a following caption line read as a GFM
	# table, so the image never renders.
	parseHTML.css('figure').each do |fig|
		fig_img = fig.at_css('img')
		caption = fig.at_css('figcaption')
		next unless fig_img && caption
		fig_img['alt'] = caption.text.strip.gsub('|') { '\|' } if fig_img['alt'].to_s.strip.empty?
	end

	# Self-host images: Medium's CDN is a third-party dependency the posts
	# outlive, so download each image into assets/images/posts/<post-stem>/ and
	# rewrite the markdown src to that site-absolute path. A failed download
	# keeps the remote URL and warns — check-build.sh then fails the build on
	# the sync PR (its Medium-CDN assertion), so a kept-remote image surfaces
	# loudly rather than shipping. Medium's RSS also appends a stat-tracking
	# pixel — dropped, not hosted. Write paths are cwd-relative (the leading "/"
	# is a URL path, stripped for binwrite); CI runs from the repo root.
	post_stem = File.basename(filename, '.md')
	img_dir_rel = "assets/images/posts/#{post_stem}"
	parseHTML.css('img[src]').each { |n| n.remove if n['src'].include?('medium.com/_/stat') }
	parseHTML.css('img[src]').each_with_index do |node, idx|
		src = node['src'].sub(/\A\/\//, 'https://')
		next unless src.start_with?('http')
		begin
			resp = HTTParty.get(src, timeout: 30)
			raise "HTTP #{resp.code}" unless resp.code == 200
			ext = File.extname(URI(src).path)
			if ext.empty? || ext.length > 5
				ext = { 'image/png' => '.png', 'image/jpeg' => '.jpg', 'image/gif' => '.gif',
					'image/webp' => '.webp' }[resp.headers['content-type'].to_s.split(';').first] || '.png'
			end
			FileUtils.mkdir_p(img_dir_rel)
			local = "/#{img_dir_rel}/img-#{format('%02d', idx + 1)}#{ext}"
			File.binwrite(local.delete_prefix('/'), resp.body)
			node['src'] = local
		rescue => img_err
			warn "  image kept remote (#{img_err.message}): #{src}"
		end
	end

	# The cover is optional: with no `background` in the front matter the
	# layouts fall back to the default OG image. Runs after localization so a
	# downloaded cover is referenced by its local path.
	img = parseHTML.at_xpath("//img[@src]")
	cover_line = if img.nil?
		''
	elsif img['src'].start_with?('/assets/')
		# Localized: the download loop rewrote src to its /assets/ path.
		"background: #{img['src']}\n"
	else
		# Download failed, src still remote. Match '/assets/' specifically, not
		# a bare '/', so a protocol-relative "//host/..." falls through here and
		# gets normalized instead of being mistaken for a local path.
		# `sub`, not `sub!` — sub! returns nil when the src is already protocol-relative.
		"background: https:#{img['src'].sub(/\Ahttp(s)?:/, '')}\n"
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
#{cover_line}excerpt_separator: <!--more-->
tags: [#{tags}]
original_link: #{original_link}
---
	META

	File.write(filename, meta + result)
rescue => err
	warn "Failed to sync \"#{e.title}\": #{err.class}: #{err.message}"
	failed_titles << e.title
end

unless failed_titles.empty?
	warn "Failed to sync #{failed_titles.length} of #{feed.entries.length} entries."
	exit 1
end
