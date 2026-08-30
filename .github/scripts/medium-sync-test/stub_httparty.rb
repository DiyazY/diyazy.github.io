# Preloaded via `ruby -r` so medium_to_md.rb runs unmodified as the main
# program but reads its "feed" from the file named in ENV['FIXTURE'].
# Explicit UTF-8: without a UTF-8 locale File.read falls back to US-ASCII
# and Feedjira's parser choke on multibyte feed content.
require 'httparty'

FakeResponse = Struct.new(:body)

def HTTParty.get(_url, *_args)
  FakeResponse.new(File.read(ENV.fetch('FIXTURE'), encoding: 'UTF-8'))
end
