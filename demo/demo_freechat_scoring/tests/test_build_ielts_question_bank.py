import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
SCRIPT = PROJECT / "scripts" / "build_ielts_question_bank.py"
P1_SOURCE = PROJECT / "data" / "2026年1-4月P1口语分类2.2.json"
P23_SOURCE = PROJECT / "data" / "2026年1-4月P2&P3口语分类2.27.json"


def load_builder():
    if not SCRIPT.exists():
        raise AssertionError(f"question-bank builder is missing: {SCRIPT}")
    spec = importlib.util.spec_from_file_location("build_ielts_question_bank", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class QuestionBankBuilderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p1_source = json.loads(P1_SOURCE.read_text(encoding="utf-8"))
        cls.p23_source = json.loads(P23_SOURCE.read_text(encoding="utf-8"))

    def test_converts_all_part1_topics_without_changing_source_order(self):
        result = load_builder().convert_part1(self.p1_source)
        self.assertEqual(72, len(result["groups"]))
        first = result["groups"][0]
        self.assertEqual("p1_home_accommodation_2026_01_04_001", first["group_id"])
        self.assertEqual(list(range(1, 18)), [q["order"] for q in first["questions"]])
        self.assertTrue(all("needs_review" in question for question in first["questions"]))

    def test_keeps_part2_and_part3_in_104_atomic_source_topic_bundles(self):
        result = load_builder().convert_part2_part3(self.p23_source)
        self.assertEqual(104, len(result["bundles"]))
        famous = next(bundle for bundle in result["bundles"]
                      if bundle["topic_id"] == "p23_2026_01_04_001")
        self.assertEqual("Describe a famous person you would like to meet",
                         famous["part2"]["topic_sentence"])
        self.assertEqual(
            [f"p23_2026_01_04_001_p3_q0{i}" for i in range(1, 7)],
            [question["question_id"] for question in famous["part3"]["questions"]],
        )
        for bundle in result["bundles"]:
            prefix = f'{bundle["topic_id"]}_p3_'
            self.assertTrue(all(question["question_id"].startswith(prefix)
                                for question in bundle["part3"]["questions"]))

    def test_marks_review_content_ineligible_without_dropping_it(self):
        builder = load_builder()
        part1 = builder.convert_part1(self.p1_source)
        part23 = builder.convert_part2_part3(self.p23_source)
        self.assertEqual(72, len(part1["groups"]))
        self.assertEqual(104, len(part23["bundles"]))
        self.assertTrue(any(not group["eligible"] for group in part1["groups"]))
        self.assertTrue(any(not bundle["eligible"] for bundle in part23["bundles"]))

    def test_rejects_duplicate_source_topic_ids(self):
        invalid = json.loads(json.dumps(self.p23_source))
        invalid["topics"][1]["id"] = invalid["topics"][0]["id"]
        with self.assertRaisesRegex(ValueError, "(?i)duplicate.*topic"):
            load_builder().convert_part2_part3(invalid)

    def test_build_writes_two_runtime_banks_and_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            summary = load_builder().build(P1_SOURCE, P23_SOURCE, Path(directory))
            manifest = json.loads((Path(directory) / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual({"part1": "part1.json", "part2_part3": "part2_part3.json"},
                             manifest["files"])
            self.assertEqual(72, summary["part1_topic_count"])
            self.assertEqual(104, summary["part2_part3_bundle_count"])
            self.assertTrue((Path(directory) / "part1.json").is_file())
            self.assertTrue((Path(directory) / "part2_part3.json").is_file())


if __name__ == "__main__":
    unittest.main()
