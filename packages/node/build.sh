#!/bin/bash

v -d no_backtrace -shared binding.v -o binding.node -cg
mv binding.node.dylib binding.node