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
	# if File.exists?(filename)
	# 	puts "#{filename} already exists. Skipping.."
	# 	next
	# end

	content = e.content
	parseHTML = Nokogiri::HTML(content)
	img = parseHTML.xpath("//img")[0]['src'].sub!(/http(s)?:/,'')
	
	# Medium feed includes the hero image in the `content` field. Since Jekyll and other systems will probably render the hero image separately, remove it from the HTML before generating the Markdown
	content.sub!(/<figure><img\salt="([\w\.\-])?"\ssrc="https:\/\/cdn-images-1.medium.com\/max\/[0-9]+\/[0-9]\*[0-9a-zA-Z._-]+"\s\/>(\<figcaption\>.*\<\/figcaption\>)?<\/figure>/, '')

	result = ReverseMarkdown.convert(content).gsub(/\\n/,"\n")
	meta = <<-META
---
layout: post
author: #{e.author}
title: #{e.title}
date: #{e.published}
background: #{img}
---

	META
	
	File.write(filename, meta + result)
end
