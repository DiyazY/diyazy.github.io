# Fixture-driven test for medium_to_md.rb. Runs the real script as a
# subprocess (network stubbed via -r stub_httparty) and asserts on the
# generated files and exit status.
#
# Run from any directory, with or without bundler:
#   bundle exec ruby .github/scripts/medium-sync-test/run_tests.rb
#   ruby .github/scripts/medium-sync-test/run_tests.rb
# The child inherits this process's gem environment, so it resolves gems
# the same way its caller does (bundled in build.yml, global gems in
# sync-medium.yml).
require 'open3'
require 'tmpdir'
require 'rbconfig'

REPO = File.expand_path('../../..', __dir__)
SCRIPT = File.join(REPO, 'medium_to_md.rb')

$failures = 0
def assert(desc, cond)
  if cond
    puts "  PASS: #{desc}"
  else
    puts "  FAIL: #{desc}"
    $failures += 1
  end
end

def run_script(fixture, outdir)
  stdout, stderr, status = Open3.capture3(
    { 'FIXTURE' => File.join(__dir__, fixture) },
    RbConfig.ruby, '-I', __dir__, '-rstub_httparty', SCRIPT, 'test-user', outdir,
    chdir: REPO
  )
  [stdout, stderr, status]
end

puts 'Scenario A: mixed feed (image / no image / protocol-relative image)'
Dir.mktmpdir do |outdir|
  _stdout, stderr, status = run_script('fixture.xml', outdir)
  files = Dir.children(outdir).sort
  puts "  exit=#{status.exitstatus} files=#{files.inspect}"
  puts stderr.lines.map { |l| "  stderr: #{l}" }.join unless status.exitstatus.zero?

  with_image    = File.join(outdir, '2026-08-03-Post-With-Image.md')
  without_image = File.join(outdir, '2026-08-04-Post-Without-Image.md')
  proto_rel     = File.join(outdir, '2026-08-05-Post-With-Protocol-Relative-Image.md')

  assert('exits 0 when every entry syncs', status.exitstatus == 0)
  assert('all three posts are written', files.length == 3)
  if File.exist?(with_image)
    assert('image post keeps its cover',
           File.read(with_image).include?('background: https://cdn-images-1.medium.com/max/1024/1*withimage.png'))
  else
    assert('image post file exists', false)
  end
  if File.exist?(without_image)
    assert('imageless post has no background: line',
           !File.read(without_image).match?(/^background:/))
  else
    assert('imageless post file exists', false)
  end
  if File.exist?(proto_rel)
    content = File.read(proto_rel)
    assert('protocol-relative src gets https: prefix (no bare "background: https:")',
           content.include?('background: https://cdn-images-1.medium.com/max/1024/1*protorel.png') &&
           !content.match?(/^background: https:\s*$/))
  else
    assert('protocol-relative post file exists', false)
  end
end

puts 'Scenario B: one broken entry (no pubDate) must not abort the rest'
Dir.mktmpdir do |outdir|
  stdout, stderr, status = run_script('fixture-bad-entry.xml', outdir)
  files = Dir.children(outdir).sort
  puts "  exit=#{status.exitstatus} files=#{files.inspect}"

  assert('good entry after the broken one is still written',
         File.exist?(File.join(outdir, '2026-08-06-Good-Entry-After-Broken-One.md')))
  assert('exits nonzero so the Actions run surfaces the failure', status.exitstatus != 0)
  assert('failing entry title is logged', (stdout + stderr).include?('Broken Entry No PubDate'))
end

puts $failures.zero? ? 'ALL PASS' : "#{$failures} FAILURE(S)"
exit($failures.zero? ? 0 : 1)
