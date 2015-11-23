package com.slipteama.ubervest;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;

import android.os.AsyncTask;

import android.os.ParcelUuid;
import android.util.Log;

import com.firebase.client.Firebase;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Created by jon on 20/10/15.
 */
public class BluetoothLeService extends AsyncTask<Void, Void, Void> {
    private final static String TAG = BluetoothLeService.class.getSimpleName();

    private BluetoothGatt mBluetoothGatt;
    private BluetoothAdapter btAdapter;
    private BluetoothDevice btDevice;
    private BluetoothLeScanner btScanner;

    public static Context mContext;

    private static UUID UBER_VEST_SERVICE_UUID = UUID.fromString("0000B000-0000-1000-8000-00805F9B34FB");

    private static UUID ECG_CHARACTERISTIC_UUID = UUID.fromString("0000B002-0000-1000-8000-00805F9B34FB");

    private Firebase firebase = new Firebase("https://ubervest.firebaseio.com/");

    private ScanCallback leScanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            if(result.getDevice().getAddress().equals("DB:00:EC:05:2E:A0")) {
                btDevice = result.getDevice();
                mBluetoothGatt = btDevice.connectGatt(mContext, false, mGattCallback);
            }
        }
    };

    private final BluetoothGattCallback mGattCallback = new BluetoothGattCallback() {
        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, final BluetoothGattCharacteristic characteristic) {
            Integer data = characteristic.getIntValue(BluetoothGattCharacteristic.FORMAT_UINT8, 0);

            Log.i(TAG, data.toString());

            long currentTime = (new Date()).getTime();
            firebase.child("devices").child("0").child("raw_ecg").child(currentTime + "").setValue(data);
        }

        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                mBluetoothGatt.discoverServices();
                Log.i(TAG, "Connected to GATT server.");
                // Attempts to discover services after successful connection.
                Log.i(TAG, "Attempting to start service discovery:" +
                        mBluetoothGatt.discoverServices());
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
            }
        }

        public void onServicesDiscovered(final BluetoothGatt gatt, final int status) {
            if(status == BluetoothGatt.GATT_SUCCESS) {
                BluetoothGattService service = gatt.getService(UBER_VEST_SERVICE_UUID);
                BluetoothGattCharacteristic chara = service.getCharacteristic(ECG_CHARACTERISTIC_UUID);
                gatt.setCharacteristicNotification(chara, true);
                for (BluetoothGattDescriptor desc : chara.getDescriptors()) {
                    desc.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    gatt.writeDescriptor(desc);
                }
            }
        }
    };

    @Override
    protected Void doInBackground(Void... params) {
        ScanFilter.Builder filterBuilder = new ScanFilter.Builder();
        filterBuilder.setServiceUuid(new ParcelUuid(UBER_VEST_SERVICE_UUID));
        ScanFilter filter = filterBuilder.build();
        List<ScanFilter> filterList = new ArrayList<ScanFilter>();
        filterList.add(filter);
        ScanSettings.Builder settingsBuilder = new ScanSettings.Builder();
        //settingsBuilder.setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE);
        settingsBuilder.setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY);
        ScanSettings settings = settingsBuilder.build();
        btScanner.startScan(filterList, settings, leScanCallback);
        return null;
    }
}