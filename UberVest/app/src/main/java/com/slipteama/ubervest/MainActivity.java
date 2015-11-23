package com.slipteama.ubervest;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.os.ParcelUuid;
import android.util.Log;
import android.view.View;
import android.view.Menu;
import android.view.MenuItem;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.ListView;
import android.widget.Switch;
import android.widget.Toast;

import com.firebase.client.Firebase;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class MainActivity extends Activity {
    private final static String TAG = MainActivity.class.getSimpleName();

    public static Context mContext;

    WebView wv;
    Switch s1;

    private BluetoothAdapter btAdapter;
    private BluetoothDevice btDevice;
    private BluetoothLeScanner btScanner;

    private BluetoothGatt mBluetoothGatt;

    private static UUID UBER_VEST_SERVICE_UUID = UUID.fromString("0000B000-0000-1000-8000-00805F9B34FB");

    private static UUID ECG_CHARACTERISTIC_UUID = UUID.fromString("0000B002-0000-1000-8000-00805F9B34FB");

    private Firebase firebase;

    Handler mHandler = new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message message) {
            Toast.makeText(getApplicationContext(), "Connected", Toast.LENGTH_SHORT).show();
        }
    };

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
                mHandler.obtainMessage().sendToTarget();
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
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mContext = getApplicationContext();
        setContentView(R.layout.activity_main);
        Firebase.setAndroidContext(this);
        firebase = new Firebase("https://ubervest.firebaseio.com/");

        s1 = (Switch)findViewById(R.id.switch1);
        wv = (WebView)findViewById(R.id.webView);
        wv.getSettings().setJavaScriptEnabled(true);

        btAdapter = BluetoothAdapter.getDefaultAdapter();
        btScanner = btAdapter.getBluetoothLeScanner();


        s1.setChecked(btAdapter.isEnabled());

        if(btAdapter.isEnabled()) {
            connect();
        }

        s1.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                if(isChecked) {
                    on();
                } else {
                    off();
                }
            }
        });

    }

    public void on() {
        if(!btAdapter.isEnabled()){
            Intent turnOn = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(turnOn, 0);
            while(!btAdapter.isEnabled()) {
            }
            btAdapter = BluetoothAdapter.getDefaultAdapter();
            btScanner = btAdapter.getBluetoothLeScanner();
            connect();
        }
    }

    public void off() {
        btAdapter.disable();
    }

    public void connect() {
        ScanFilter.Builder filterBuilder = new ScanFilter.Builder();
        filterBuilder.setDeviceAddress("DB:00:EC:05:2E:A0");
        filterBuilder.setServiceUuid(new ParcelUuid(UBER_VEST_SERVICE_UUID));
        ScanFilter filter = filterBuilder.build();
        List<ScanFilter> filterList = new ArrayList<ScanFilter>();
        filterList.add(filter);
        ScanSettings.Builder settingsBuilder = new ScanSettings.Builder();
        //settingsBuilder.setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE);
        settingsBuilder.setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY);
        ScanSettings settings = settingsBuilder.build();
        btScanner.startScan(filterList, settings, leScanCallback);
        Uri uri = Uri.parse("http://groups.inf.ed.ac.uk/teaching/slipa15-16/#/login");
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        startActivity(intent);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.menu_main, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        int id = item.getItemId();

        //noinspection SimplifiableIfStatement
        if (id == R.id.action_settings) {
            return true;
        }

        return super.onOptionsItemSelected(item);
    }

}
