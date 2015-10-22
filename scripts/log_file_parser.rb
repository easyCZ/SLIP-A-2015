#!/usr/bin/env ruby

text = File.open(ARGV[0]).read
text.gsub!(/\r\n?/, "\n")
text.each_line do |line|
  time = line.match /(\d\d):(\d\d):(\d\d).(\d\d\d)/
  value = line[-3..-2].to_i(16)
  puts "#{time}, #{value}"
end
