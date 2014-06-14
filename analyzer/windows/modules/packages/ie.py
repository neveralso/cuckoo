# Copyright (C) 2010-2014 Cuckoo Foundation.
# This file is part of Cuckoo Sandbox - http://www.cuckoosandbox.org
# See the file 'docs/LICENSE' for copying permission.

import os

from lib.common.abstracts import Package
from lib.api.process import Process
from lib.common.exceptions import CuckooPackageError

class IE(Package):
    """Internet Explorer analysis package."""

    def start(self, url):
        free = self.options.get("free", False)
        dll = self.options.get("dll", None)
        suspended = True
        if free:
            suspended = False

        if os.getenv("ProgramFiles(x86)"):
            iexplore = os.path.join(os.getenv("ProgramFiles(x86)"), "Internet Explorer", "iexplore.exe")
        else:
            iexplore = os.path.join(os.getenv("ProgramFiles"), "Internet Explorer", "iexplore.exe")
            
        p = Process()
        if not p.execute(path=iexplore, args="\"%s\"" % url, suspended=suspended):
            raise CuckooPackageError("Unable to execute initial Internet "
                                     "Explorer process, analysis aborted")

        if not free and suspended:
            p.inject(dll)
            p.resume()
            return p.pid
        else:
            return None
