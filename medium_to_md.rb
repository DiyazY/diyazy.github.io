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

	tags = e.categories.join(', ')
	original_link = e.url

	result = ReverseMarkdown.convert(content).gsub(/\\n/,"\n")

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
