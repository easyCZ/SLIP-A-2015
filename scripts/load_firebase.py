import argparse
import requests
import time

DEFAULT_DEVICE = 0
DEFAULT_FILE = '../data/ECG_data.csv'

def main(device=0, filename=DEFAULT_FILE):
    print("Loading firebase for device #%d" % device)
    with open(filename) as f:
        index = 0
        count = 0

        timestamp = int(time.time() * 1000)
        for line in f:
            line = line.strip()
            ts, value = line.split(',', 1)
            count += float(value)
            index += 1


            if index == 10:
                # Dump
                timestamp += 1
                print("Sending %s: %s" % (str(timestamp), str(count / 10)))
                requests.put(('https://ubervest.firebaseio.com/devices/%d/hr/' % device) + str(timestamp) + '.json', data=str(count / 10))
                count = 0
                index = 0

        timestamp += 1
        requests.put(('https://ubervest.firebaseio.com/devices/%d/hr/' % device) + str(timestamp) + '.json', data=str(count / 10))



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Load sample data for a given device')
    parser.add_argument('--d', type=int, default=DEFAULT_DEVICE, help="The ID of the device to load with data.")
    parser.add_argument('--f', type=str, default=DEFAULT_FILE, help="The location of file for the data.")

    args = parser.parse_args()

    main(device=args.d, filename=args.f)
