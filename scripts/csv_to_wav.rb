#!/usr/bin/env ruby
require 'csv'
require 'wavefile'

include WaveFile

data = CSV.read(ARGV[0])

data.map! { |a| a[1].to_f / 1024 }
buffer = Buffer.new(data, Format.new(:mono, :float, 10))

Writer.new("#{ARGV[0]}.wav", Format.new(:mono, :pcm_16, 10)) do |writer|
  writer.write(buffer)
end
