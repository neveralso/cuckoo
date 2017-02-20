# Copyright (C) 2016-2017 Cuckoo Foundation.
# This file is part of Cuckoo Sandbox - http://www.cuckoosandbox.org
# See the file 'docs/LICENSE' for copying permission.

import mock
import os.path
import tempfile

from cuckoo.core.database import Database
from cuckoo.misc import set_cwd
from cuckoo.processing.debug import Debug
from cuckoo.processing.screenshots import Screenshots
from cuckoo.processing.static import Static

class TestProcessing:
    def test_debug(self):
        db = Database()

        set_cwd(tempfile.mkdtemp())

        db.connect(dsn="sqlite:///:memory:")
        db.add_url("http://google.com/")
        db.add_error("foo", 1)
        db.add_error("bar", 1)

        d = Debug()
        d.task = {
            "id": 1,
        }
        d.log_path = "nothing_to_see_here"
        d.cuckoolog_path = "neither here"
        d.action_path = "or here.."
        d.mitmerr_path = "no no no"

        results = d.run()
        assert len(list(results["errors"])) == len(results["errors"])

    def test_pdf(self):
        s = Static()
        s.set_task({
            "category": "file",
            "package": "pdf",
            "target": "pdf0.pdf",
        })
        s.set_options({
            "pdf_timeout": 30,
        })
        s.file_path = "tests/files/pdf0.pdf"
        r = s.run()["pdf"][0]
        assert "var x = unescape" in r["javascript"][0]["orig_code"]

    def test_office(self):
        s = Static()
        s.set_task({
            "category": "file",
            "package": "doc",
            "target": "createproc1.docm",
        })
        s.file_path = "tests/files/createproc1.docm"
        r = s.run()["office"]
        assert "ThisDocument" in r["macros"][0]["orig_code"]
        assert "Sub AutoOpen" in r["macros"][1]["orig_code"]
        assert 'process.Create("notepad.exe"' in r["macros"][1]["orig_code"]

    @mock.patch("cuckoo.processing.screenshots.log")
    def test_screenshot_tesseract(self, p):
        s = Screenshots()
        # Use an empty directory so no actual screenshot analysis is done.
        s.shots_path = tempfile.mkdtemp()
        s.set_options({
            "tesseract": None,
        })
        assert s.run() == []
        p.error.assert_not_called()

        s.set_options({
            "tesseract": "no",
        })
        assert s.run() == []
        p.error.assert_not_called()

        s.set_options({
            "tesseract": "thispathdoesnotexist",
        })
        assert s.run() == []
        p.error.assert_called_once()

    @mock.patch("cuckoo.processing.screenshots.subprocess")
    def test_screenshots(self, p):
        s = Screenshots()
        s.shots_path = os.path.join(
            "tests", "files", "sample_analysis_storage", "shots"
        )
        s.set_options({
            "tesseract": __file__,
        })
        p.check_output.return_value = "foobar"
        assert s.run() == [{
            "path": os.path.join(s.shots_path, "0001.jpg"),
            "ocr": "foobar",
        }]
        p.check_output.assert_called_once_with([
            __file__, os.path.join(s.shots_path, "0001.jpg"), "stdout"
        ])
        shotpath = os.path.join(
            "tests", "files", "sample_analysis_storage",
            "shots", "0001_small.jpg"
        )
        assert os.path.exists(shotpath)
        os.unlink(shotpath)

    @mock.patch("cuckoo.processing.screenshots.subprocess")
    @mock.patch("cuckoo.processing.screenshots.log")
    def test_ignore_notesseract(self, p, q):
        s = Screenshots()
        s.shots_path = os.path.join(
            "tests", "files", "sample_analysis_storage", "shots"
        )
        s.set_options({
            "tesseract": "no",
        })
        assert len(s.run()) == 1
        p.error.assert_not_called()
        p.warning.assert_not_called()
        q.check_output.assert_not_called()
        shotpath = os.path.join(
            "tests", "files", "sample_analysis_storage",
            "shots", "0001_small.jpg"
        )
        assert os.path.exists(shotpath)
        os.unlink(shotpath)