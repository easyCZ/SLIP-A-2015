import json
import csv
from services import BPMServices

def get_json(file_name):
    with open(file_name) as f:
        json_data = json.loads(f.read())
        return json_data
    return {}


def main():
    Hayden_data = get_json('Hayden_raw_ecg.JSON')
    Hayden = BPMServices(Hayden_data)
    hayden_beats = Hayden.get_peaks()
    Hayden_BPM = Hayden.get_bpm()
    window_beats =[]
    a = 1
    b = 1
    # for beat in Hayden_beats:
    #     if beat[0] > a
    print Hayden_BPM

main()